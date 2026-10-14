# Zen Main Presentation Scene Architecture

- Status: Active
- Owner: zen dashboard architecture
- Last validated against code: 2026-10-13
- Path policy: current-only
- Canonical for: release V1 Zen main `current` and `first_vision` scene decisions and projections

## Release V1 Scene Set

The Zen main tab admits exactly two scene kinds:

- `current`: the normal live presentation derived from current canonical
  dashboard facts and current Zen model state.
- `first_vision`: the one-time first-install ceremony selected from progression
  state and projected without mutating current runtime/model truth.

Unknown scene kinds fail loudly. Main has no third scene, period-snapshot
reader, presentation-event ledger, or disabled recap feature flag in release
V1. The first committed Furin installation is a separate dashboard guidance
overlay through `src/themes/core/presentation/installationPresentation.js`;
it leaves this scene decision and all live pond/bonsai facts unchanged. Guidance
owns the installation's claims and receipts, without using this conductor or
the real protection presentation's daily receipts.

## Owner Map

The `current` pond includes one shadow sentinel, a domainless `invitation` entity
whose registration action is enabled only after the interaction lock clears.
It remains when the budget is full; the app owns the sheet and quota guidance.
Successful Main registration supplies a transient `invitationAssignment` receipt
on the matching roster site. The worker assigns the current shadow's pose to that
site once and admits a fresh shadow from a varying bank/lane; roster refresh or
selection alone cannot create this receipt. It never enters appearance/activity
memory or durable progression state.
`first_vision` keeps its declared ideal roster without the sentinel. The sentinel
uses the explicit `shadow_sentinel` appearance presentation role, carried through
roster normalization, projection, worker payload and world sync. It has no special
body pigment: Pixi hides the material body and tail, renders the existing packed
shadow coverage at the same spine position, and flattens the moving fins to
translucent silhouettes. `zenKoiShadowSentinelPresentation.js` owns this authored
shadow-only role, including its bounded night readability and independence from
the ordinary solar cast-shadow setting. It has no eyes, scales, reflections or
second cast shadow. No settings, stats, appearance memory or progression receipt
is created for it. Site assignment clears the role and restores ordinary material
visibility/tints on the same physical fish.

| Concern | Canonical owner | Output | Forbidden shortcut |
| --- | --- | --- | --- |
| shared scene/phase contract | `src/themes/core/presentation/mainSceneContract.js` | canonical scene and phase enums shared by the app conductor and theme projection | theme plugin importing dashboard owners or duplicating phase strings |
| scene decision builder | `src/apps/dashboard/presentation/mainPresentationDecision.js` | typed `current` or `first_vision` decision | component-local booleans deciding scene kind |
| dashboard presentation conductor | `src/apps/dashboard/presentation/useMainPresentationScene.js` + `mainPresentationSessionState.js` | one boot-scoped, commit-driven scene sequence | component timers or overlay callbacks independently switching scenes |
| shared Dashboard presentation admission | `src/apps/dashboard/presentation/DashboardPresentationAdmission.jsx` + `DashboardPage.jsx` | one native foreground observation and passive exclusive/contextual admission snapshot | an event master deciding progression, duplicate foreground subscriptions in consumers, missing-provider defaults, or a durable presentation queue |
| presentation session lifetime and active dwell | `usePresentationSessionLifetime.js` + `activePresentationClock.js` | theme/boot generation fencing and monotonic admitted presentation time | wall time consuming an unseen dream or a previous lifetime advancing the replacement reducer |
| first-vision eligibility/presented/spent state | progression domain | durable first-vision lifecycle facts | Zen storage, local flags, or a render callback owning first-install truth |
| Zen scene projection | `src/themes/plugins/zen/presentation/main/zenMainSceneProjection.js` | typed pond/bonsai/rail/overlay/interaction projections | pond/bonsai/widgets re-deciding the scene |
| live pressure facts | dashboard/stats current read models | current pressure candidates and marker facts | presentation code writing stats/model state |

## Decision Flow

```text
progression first-vision state + boot readiness
  -> boot-scoped main presentation state machine
  -> mainPresentationDecision + render sceneCommitKey
  -> zenMainSceneProjection
  -> same pond / bonsai / pressure rail / marker layout
  -> exact pond + bonsai frame acknowledgements
  -> controlled cover / current commit / uncover
```

When first vision is not eligible or finishes, the decision settles on
`current`. Selection and projection remain separate: the app chooses the scene;
the Zen adapter chooses how each surface expresses it.

The conductor keeps the unstarted boot projection in `resolving` and admits its
typed progression read only after the boot owner publishes a positive
`startedAt`. It does not wait for core readiness, shell dismissal or render ACKs.
Readiness updates reuse that boot's read; a new real boot identity requests fresh
progression state and ignores a response from the previous session. An unstarted
placeholder cannot commit a presentation scene.

Each boot/theme lifetime has a distinct generation, including a theme change
away and back within the same millisecond. The lifetime changes synchronously
before effect cleanup. Reads, presented/spent completion handling, scene ACKs,
cover callbacks and overlay completion from the replaced lifetime cannot advance
the new reducer. This cancels local presentation effects, not an already admitted
background write; the next lifetime reads the durable result from progression.

## Dashboard Presentation Admission

`DashboardPage` owns the single `useDashboardPresentationForeground()` observer
for the conjunction of document visibility and native document focus. It passes
that accepted boolean explicitly to the conductor as `presentationActive` and
publishes the same observation through `DashboardPresentationAdmissionProvider`.
The pure `resolveDashboardPresentationAdmission()` adds boot/scene release,
First Vision's exclusive lifecycle and a pending general Dashboard ceremony.
Its snapshot contains `foregroundActive`, `generalCeremonyActive`,
`exclusivePresentationActive` and `contextualPresentationAllowed`.

Home first bloom, growth acknowledgement and Guidance use contextual admission
alongside their own exact-frame, anchor, interaction and domain eligibility gates.
They do not subscribe independently to foreground changes. Native first-bloom
input still synchronously rechecks visibility/focus to reject a click that races
the observer update. A missing provider is an integration error; isolated tests
must provide explicit admission.

The admission owner neither chooses a Main scene nor owns progression facts,
Guidance claims, first-bloom receipts, renderer ACKs or animation clocks. It adds
no durable event ledger or background synchronization. A general ceremony request
waits until boot and scene resolution release the surface and the complete First
Vision lifecycle ends. Dashboard retains one transient request; a replacement
has a fresh generation, and completion from the previous request cannot clear it.
General and First Vision overlays cannot be active together.

## Decision Contract

A decision contains:

- `kind: 'current' | 'first_vision'`
- boot-scoped `sceneSessionId`
- phase (`resolving`, `preparing_first_vision`, `first_vision_committed`,
  `presenting`, `covering`, `preparing_current`, `current_committed`,
  `uncovering`, `settled`, or explicit `deferred`)
- `renderTarget.kind`, which may become `current` while the session kind remains
  `first_vision` under the opaque cover
- a boot-scoped `renderTarget.sceneCommitKey`
- source/diagnostic metadata
- current or first-install time-scope identity

Malformed inputs or unknown enum values are integration errors. Normalizers may
copy/validate the current shape but must not infer a removed scene.

## Projection Contract

The projection adapter emits the only presentation inputs consumed by Zen
surfaces:

- pond presentation/environment, strict data-isolation, and roster-memory policy,
- bonsai presentation, immutable presentation identity, and cultivation-ledger policy,
- pressure-rail and rhythm-marker mode,
- overlay mode,
- interaction and selection-mutation policy.

For `current`, canonical live owners may read and write their normal state. For
`first_vision`, mutable live owners are locked or bypassed as declared by the
projection; the ceremony cannot write a synthetic bonsai lineage, pond roster,
stats row, or current settings value.

The First Vision pond projection must carry `dataIsolationMode: true`. Scanner
container and surface boundaries validate that exact contract; importing the
appearance store is side-effect free, and the isolated surface neither hydrates
nor persists appearance, activity-profile, roster-memory, or interaction state.
An appearance/activity ModelState failure in `current` is a named surface error,
not permission to keep rendering from an in-memory substitute.
The current pond worker stays unmounted until roster memory and both cache
hydrations ACK. A synchronous cache read cannot secretly begin hydration or
expose `{}` as canonical state; unhydrated reads and mutations fail loudly.
Roster-memory read/write/clear failure likewise fails the current surface rather
than continuing from empty or memory-only state. First Vision keeps its immediate
ready path because isolation performs no cache operation at all.

First Vision does not own a second dashboard layout. Sidebar, lower rhythm
surfaces, pond, and bonsai keep the same DOM and geometry as `current`. Visual
emphasis is projected through the typed `visualEmphasis` token: from
`preparing_first_vision` through `uncovering`, the existing sidebar and rhythm
surfaces receive only very light filter/opacity attenuation and the existing
pond/bonsai apertures receive a static pseudo-element edge glow. `resolving`,
`deferred`, and `settled` project no emphasis. The paint path must not hide,
translate, unmount, replace, or make dashboard chrome inert; reduced-motion
removes emphasis transitions and forced-colors removes attenuation/glow. The
Zen First Vision roster is the sole owner of its five-koi visual truth;
progression metadata must not duplicate renderer counts or ceremony phase
timing.

## First-Vision Session Rules

- Public builds select First Vision only from the canonical progression
  snapshot. In `build:dev`, the build-profile projection alias may replace only
  the presentation-facing state: default `develop` resolves as `SPENT`, while
  explicit `first_vision_preview` resolves as `PENDING`. The DTO retains the
  canonical snapshot and typed session descriptor so projected state is never
  confused with durable progression truth.
- A development preview still runs this exact conductor, ideal scene,
  composite-ACK sequence, cover boundary, and ceremony. Its presented/spent
  acknowledgements are projected locally; it performs no canonical milestone
  write. After the covered current commit, the session owner returns to `develop`
  at the selected day only if the captured replay descriptor is still current.
  A newer development selection is preserved while the older visual session may
  complete its cover handoff. `canonical` mode uses the ordinary durable commands
  unchanged.
- `PENDING` and `PRESENTED` both select the ideal First Vision render target;
  `PRESENTED && !SPENT` is a resumable session, never an implicit current scene.
- `PRESENTED` is recorded only after the exact ideal pond and bonsai frames have
  acknowledged the same scene commit key and the boot reveal is healthy.
- A presented command may acknowledge canonical `SPENT` when another Dashboard
  tab has already completed the experience. This is an explicit
  `FIRST_VISION_SPENT_ELSEWHERE` transition to `covering`, not a simulated
  `PRESENTED` ACK or a persistence failure. The exact ideal frame is retired
  beneath actual opaque cover; the exact current composite ACK is still required
  before uncover. The accepted durable `SPENT` receipt avoids redundant
  presented/spent commands during that handoff.
- before that exact First Vision commit, a degraded boot may defer the ceremony
  and render `current` for the boot without consuming it. After the exact commit,
  presentation-persistence or boot degradation holds the committed First Vision
  frame with a named diagnostic; it cannot swap to `current` without the opaque
  cover boundary.
- closing or leaving before the covered current commit does not consume the
  experience. The next healthy dashboard boot resumes the ideal scene.
- dream dwell starts only after actual boot shell dismissal and accepted
  foreground admission. `activePresentationClock` accumulates monotonic active
  time and retains the remainder across blur/hidden intervals. The existing
  12-second minimum plus 2.8-second descent delay is unchanged; wall time while
  inactive cannot satisfy either portion.
- after the meaningful dream dwell, the overlay reports actual opaque cover.
  Only then may the same pond and bonsai renderers switch to `current`.
- the opaque cover remains held until both current surfaces acknowledge the
  current scene commit key. Progression records `SPENT` in that boundary,
  atomically disclosing the initial artifact family, before uncover begins.
- A changed pond presentation scene commit replaces the worker-local koi
  population beneath that cover. Serialized bank entry/exit belongs only to
  membership changes within one scene; First Vision koi must not delay the
  current scene's exact roster/frame ACK. The physical renderer is retained.
- trailing petals and fade are aesthetic only. Leaving after `SPENT` cannot
  re-lock artifacts or replay First Vision.
- First Vision descent keeps the existing cover opaque/hold milestones while
  using a bounded 30fps, 1.35 device-pixel-ratio, 112-petal render profile.
  Petal density quiets as the cover rises, radiance precedes the opaque plane,
  and only a deterministic subset receives the foreground depth pass.
- First Vision, Experiment Lab, and development progression preview
  materialization never create a second G15.4 topology owner or write Classic2
  comparison lineage state. First Vision uses its immutable identity; Lab owns
  isolated presentation input; the Main progression preview remains read-only.
- First Vision topology uses the named immutable
  `ZEN_BONSAI_FIRST_VISION_PRESENTATION_IDENTITY`. It does not borrow the active
  durable aggregate and does not substitute a seed-zero placeholder while that
  aggregate is loading. Current mode remains unresolved until its exact durable
  active identity is ready.
- G15.4 structural time derives from the canonical product life-state adapter.
  A Classic2 comparison may derive `ephemeral_scrub` inside its isolated surface,
  but Home cannot pass an independent comparison clock into G15.4.
- bonsai owns no durable visual checkpoint. `current` waits for canonical
  evidence plus cultivation commit and materializes that exact target once;
  First Vision materializes its explicit ideal read-only target. Mode/input
  changes synchronously invalidate the previous materialization as current
  truth.
- a bonsai worker acknowledgement is current only when `sceneCommitKey`, the
  canonical input signature, and `bonsaiMaterializationKey` all match the
  prepared scene. The Home composite coordinator cannot combine parts from
  different bonsai materializations.
- retained Main의 Classic2 canvas/controller lifetime은 탭 가시성 및 scene
  readiness와 분리한다. hidden/0x0/lineage-wait 상태에서는 렌더와 scene sync를
  park하되 이미 transfer된 canvas에 두 번째 controller를 만들지 않는다.
- exact current-frame readiness와 retained canvas paint visibility는 별도
  계약이다. 동일한 physical canvas, `sceneCommitKey`, active-tree identity
  안에서는 마지막 exact-ACK paint를 input/materialization 전환 중에도 유지하고,
  다음 exact ACK에서 교체한다. 이 presentation latch는 pending target의 ACK,
  composite/boot readiness, First Vision 진행, progression disclosure 근거가 될 수
  없다. scene 또는 tree identity가 바뀌거나 canvas가 교체되면 latch를 닫는다.
- a first-vision failure is surfaced through boot/ceremony diagnostics; it does
  not select another model or scene.
- the build:dev qualified-use preview is a bonsai submode of the existing
  `current` scene, not a third Main scene. It sets a read-only cultivation
  policy and cannot persist lineage, ledger, disclosure, or qualified-use
  progress.
- the canonical catch-up reveal shown over a prepared current bonsai is a
  UI-only acknowledgement. It does not select a scene, block renderer
  readiness, replay First Vision, or become progression truth.

## Persistence Boundary

Main presentation selection owns no dedicated storage surface. Durable facts
remain with their existing owners:

- progression owns first-vision eligibility/spent state,
- stats owns current usage facts,
- Zen typed repositories own current workspace/model state,
- bonsai cultivation and Classic2 lineage remain typed durable state, while
  the exact renderer materialization stays in memory,
- the boot-scoped scene session stays in memory.

Adding a period presentation, snapshot store, or durable presentation-event
ledger after public release requires a separate architecture decision rather
than a dormant release V1 compatibility seam.

## Failure Policy

| Failure | Required behavior |
| --- | --- |
| unknown scene/projection enum | explicit error |
| missing/malformed build:dev progression projection | explicit error; never infer canonical or spent |
| missing decision | diagnosed unavailable state; no inferred special scene |
| current facts unavailable | current-scene error/degraded surface owned by the read-model boundary |
| first-vision readiness failure | explicit ceremony/boot diagnostic |
| boot hard-timeout forced visual release before First Vision commit | select `DEFERRED` current for this boot; do not record First Vision as presented or spent |
| boot degradation or `PRESENTED` persistence failure after First Vision commit | remain in `first_vision_committed`, keep the exact committed First Vision scene contract, and raise `FIRST_VISION_BOOT_DEGRADED_AFTER_SCENE_COMMIT` or `FIRST_VISION_PRESENTED_PERSIST_FAILED_AFTER_SCENE_COMMIT` to the Dashboard error surface; retry on a later healthy boot, never switch uncovered to current |
| stale pond/bonsai scene ACK | ignore with trace; never advance the sequence |
| late read, command completion or overlay callback after theme/boot replacement | ignore outside the captured presentation lifetime; retain any already committed durable progression fact |
| presented command acknowledges `SPENT` committed by another tab | explicit covered current handoff with exact current composite ACK; no false persistence error or duplicate spent command |
| missing foreground admission or contextual provider | explicit integration error; never assume presentation permission |
| pond/bonsai composite ACK deadline while preparing First Vision | raise `ZEN_HOME_PRESENTATION_SCENE_COMPOSITE_ACK_STALLED` with `first_vision_scene_composite_ack_deadline_exceeded`; do not wait indefinitely or substitute current |
| pond/bonsai composite ACK deadline while preparing covered current | raise `ZEN_HOME_PRESENTATION_SCENE_COMPOSITE_ACK_STALLED` with `current_scene_composite_ack_deadline_exceeded`; keep the cover and do not reveal an uncommitted current scene |
| `PRESENTED` without `SPENT` on a later boot | resume First Vision on the next healthy boot |
| `SPENT` persistence failure after current commit | keep the cover opaque, remain in `current_committed`, and retry/fail loudly; never reveal current or unlock from an uncommitted state |
| First Vision pond cache/model access | contract failure: the isolated scene must not open those owners |
| Zen Main lineage failure | fail the bonsai surface; never substitute `classic` or `vnext` |

## First bloom within current Home

The first bloom is a click-driven presentation of `current`, not a third scene
kind or a First Vision replay. `useBonsaiFirstBloom` consumes the progression
snapshot's strict `bonsaiFirstBloom: { eligible, opened,
canonicalFirstVisionSpent }` projection. Progression owns eligibility from the
shared raw qualified-use facts, canonical mode, spent First Vision, Bonsai's own
full-form policy and the durable opening receipt. The UI does not infer it from
an artifact journey day threshold. At the current five-day Bonsai full-form
release, an eligible unopened profile holds the final tree's blossoms in their
closed atlas pose; canonical growth, anatomy, habit activation and weather stay
unchanged. Debug unlock projections and named capture fixtures do not consume
this milestone. An ideal First Vision render target receives no held pose.

`bonsaiFirstBloomAdmission` requires the actual boot shell dismissal, presented
Pond-mode Home, exact accepted Bonsai scene/input/materialization frame, a settled
`current` decision and no cover, interaction lock or registration editor.
The hook consumes shared contextual admission, then synchronously rechecks native
visibility/focus on the button's click/keyboard action. It owns no foreground
listener. General Dashboard ceremony and Guidance admission remain separate from
the domain's first-bloom eligibility and receipt.
Five representative closed buds invite touch visually, without visible copy or
a separate labeled control. Native 44px hit targets retain accessible names and
keyboard focus rings. Their centers come from the same cached, deterministic
five-region partition of actual signed display-plan flowers used by Canvas and
Pixi. The host projects those centers through the current canvas viewport and
validates their exact accepted-frame identity; it does not guess percentages.
The existing worker clock gives only those five flowers two restrained breaths,
then a still cue. The cue never starts playback or consumes a receipt.
At canonical Bonsai full-form release and later, this interaction replaces the generic growth
notification entirely, including after completion; it does not stack another
auto-acknowledged growth card behind the opening.

The trusted generation-fenced `claimBonsaiFirstBloom` command serializes the
profile-wide milestone with the existing progression queue. Only its durable
`newlyOpened: true` ACK admits the first touched region in that tab. Further
distinct touches only add bits to a local five-bit mask; there are no further
claims or storage writes. Each bit is accepted once, and regions can open
concurrently. A duplicate claim from another tab resolves
directly to the existing final tree. An ACK failure retains the closed pose and
allows retry through the same visual target, with a screen-reader-only error.
The claiming tab keeps its local presentation after the canonical opened receipt
arrives and eligibility becomes false. Its local event identity depends on
canonical full-form readiness, not on unopened eligibility. Reload after a
successful claim shows the final tree; partial regional
progress is transient and never queued for replay. Reduced motion resolves only
each explicitly touched region to its endpoint, preserving all five touches.

The existing Bonsai worker loop samples five fixed 900ms regional clocks in one
transient record. It returns one stable five-element progress array; each
flower reads its precompiled region index. A new touch cannot reset an earlier
region, and stale pending/partial controls cannot rewind accepted touches.
While a qualifying projection computes, the first held-pose control waits for
its prepared SCENE rather than targeting a retained pre-release tree without
flowers. An existing event still receives pause controls during that wait.
Blur, hidden document, parked Home, cover or lost exact-frame readiness pauses
its admitted clock without replaying elapsed hidden time. Independent
`BLOOM_PRESENTATION` controls are fenced by scene/input/materialization identity;
they do not alter render-plan, scene-cache or environment signatures. Completion
uses that same exact identity, including a fresh terminal receipt when the same
event's materialization changes. Seed replacement settles an already claimed
event to the complete endpoint. Only all five completed regions emit the global
terminal receipt; seed replacement uses its explicit identity-change reason.
That reason and full mask are retained when re-acknowledging a new materialization.
Unmount and profile replacement discard the local presentation lifetime.

Home suppresses new app petal emission categorically while the first bloom is
held or playing; existing airborne petals may finish. Completion republishes
the original source once. No progress frame recalculates petal supply, adds a
burst, changes weather, creates another canvas or starts another render loop.

Canonical growth catch-up reads `canonicalBonsaiRelease.qualifiedUseDayCount`
and the Bonsai-owned full-form cap. Artifact journey display counts and its
completion target do not determine the tree's age or acknowledgement. Shared
contextual admission and the exact current frame gate must both be open before
its UI-only auto-ack timer runs. Debug projections cannot update that record.

## Guardrails

- `npm run check:release-v1:baseline`
- `npm run check:theme-state:contract`
- `npm run check:zen:architecture`
- dashboard main-presentation decision/session/projection tests
- `npm run check:dashboard:owner-architecture`
