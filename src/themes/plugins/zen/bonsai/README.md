# Zen Bonsai Module

This folder is the ownership boundary for the main-tab bonsai experience.

## Physical Layers

- `state/`: pure calculation. It turns dashboard facts and bonsai life state into user-facing experience contracts. It must not import React, renderer code, UI components, storage, or browser APIs.
- `storage/`: typed persistence adapters for bonsai-owned model state. It may call Zen model-state repositories, but it must not calculate growth or render UI.
- `runtime/`: orchestration hooks. It resolves one exact materialization from canonical evidence and opens lineage/render work only for that request. It may import `state/` and `storage/`, but renderer code should only consume its contract.
- `rendering/`: runtime adapters. It packages state contracts, growth projections, and action policy for the classic renderer. It may import `state/` and existing renderer model helpers, but it must not render UI.
- `ui/`: display primitives. It renders already-resolved contracts from `state/` or `rendering/`. It must not calculate growth authority or read storage.

## Direction

The dependency direction is:

`dashboard facts -> bonsai/state -> bonsai/runtime -> bonsai/rendering -> widgets/runtime UI`

Current main-tab bonsai behavior enters through this module instead of adding growth, action, or diagnostics decisions directly inside viewport components.

## State Ownership Contract

The bonsai experience has four explicit state classes:

1. Evidence: facts from dashboard read models, such as protected time, practice counts, site registration, score details, and active days. Evidence is not render state.
2. Target: the life state computed from evidence. Target calculation may use the cultivation ledger to cap day-to-day changes.
3. Materialization: a boot/runtime request-keyed, in-memory commitment of the exact target that may enter lineage and rendering. It is never a second durable visual checkpoint.
4. Active profile aggregate: the single durable current-tree unit. It owns the
   complete active identity and its Classic2 lineage together. The nested lineage
   records every parent-causal candidate branch, its immutable
   development/mature progress, parent relation, and bounded habit observation
   provenance. It does not prune candidate topology.

The only durable current-tree entry is `zen_bonsai_profile_aggregate_v1`. Its
active identity contains the Sakura tree seed, canonical latent/version,
structure mode/depth, topology reference height, canonical generation inputs
including nullable `spineGenerationConditionId`, and aggregate-issued
`identityRevision`. Genesis/default condition is `null`; an authored ephemeral
condition belongs to that preview's complete identity and changing it rotates
the isolated preview lineage. It cannot be overlaid on a mismatched durable
identity. The same record contains the identity
fingerprint, nested lineage, transaction-facing `stateRevision`, and durable
`profileEpoch` stamped from the reserved ModelState profile-epoch row.

Ownership inside that record is deliberately narrow. The Classic2 identity
contract owns canonical identity fingerprinting. The profile aggregate model
owns complete identity and lineage mutation semantics, while the typed aggregate
repository owns persistence. The platform storage contract owns the physical
key and exact persisted shape. The background-only generation genesis may
construct one lineage-null initial aggregate; it must not import the mutable
lineage, scoring, renderer, or Sakura presentation graph.

The reserved epoch row is the reset-generation authority. Aggregate bootstrap
and every identity/lineage CAS compare that row and the aggregate/proposal epoch
inside the same IndexedDB transaction. Full reset clears model state and commits
its new `resetId` epoch atomically. The session lifecycle fence closes and drains
writers across contexts; the durable epoch check is the storage linearization
fence. Revision numbers may restart after reset without admitting an old runtime
from the previous epoch.

The current lineage record accepts exactly
`classic2_development_lineage_release_v1`. Every reached candidate is admitted
once its parent and deterministic development time are available. The retained
pure scoring seam records a bounded structural/history observation only; its
score cannot select, retire, block, or delete a branch. Current activation and
vNext runtime state remain forbidden inputs. The prepared candidate also owns
terminal-carrier metadata and its fingerprint. A real identity change is
validated against the expected active identity and commits one complete identity
in one aggregate CAS. That CAS advances identity and state revision exactly once
and clears the old lineage. The new lineage is then materialized only against
that exact active identity; it never treats the old tree's carrier map as
evidence for the new tree.

`statusSnapshot` and `bonsaiLifecycleInput` are evidence sources only. They must not be treated as the current render state. `runtime/useZenBonsaiMaterializationRuntime.js` is the bridge that turns one canonical input into one exact target, commits the cultivation ledger when required, and emits a request-keyed renderer-facing materialization whose `lifeState` already equals `targetLifeState`.

`model/ZenBonsaiLifeState.js` is the narrow pure normalization contract for
that renderer-facing state. Renderer projection code imports it directly;
`ZenBonsaiLifecycle` remains the composition owner and must not become a worker
dependency just because a renderer needs normalization.

`ZenBonsaiCultivationLedger` and `ZenBonsaiClassic2LineageState` are intentionally separate:

- `ZenBonsaiCultivationLedger`: baseline and daily target-cap authority.
- `ZenBonsaiClassic2LineageState`: current-tree branch history, fenced by the
  aggregate active identity revision and fingerprint.

Do not merge those concepts. The materialization runtime may commit a capped target, but it cannot use a prior visual state as boot authority or ease between two semantic trees.

The raw Zen model-state keys for those records are owned by `storage/`
repositories. Runtime hooks ask `ZenBonsaiCultivationRepository` and
`ZenBonsaiProfileAggregateRepository` for typed records instead of reading
storage keys directly. `zen_bonsai_presentation_state_v1`, the standalone
`zen_bonsai_classic2_lineage_state_v1` slot, and the former bonsai
seed/latent/identity localStorage keys are outside the release V1 active
contract. Runtime read-through, migration, dual-write, and cleanup paths are
forbidden.

## Update Cadence

Target judgment is event-driven. It happens when trusted evidence changes:

- stats facts changed -> background emits the stats event -> dashboard refreshes `statusSnapshot` -> `bonsaiLifecycleInput` signature changes
- policy/rules changed -> dashboard policy fingerprint changes -> status snapshot refreshes -> evidence signature changes
- reset/day boundary changed -> cycle/read-model refresh changes evidence
- future bonsai grants -> action/grant owner changes the action/evidence input

Current-runtime `bonsaiLifecycleInput` must include `bonsaiEvidenceReady: true` before it can author a new target. Partial bootstrap/prewarm objects, stale policy snapshots, and objects with missing score/growth metric shape are evidence candidates only; they must not advance cultivation ledgers or enter lineage/render scene sync. First Vision is a separate explicit read-only scene input and therefore does not wait for current stats evidence.

Elapsed calendar days are not growth authority. Current Main receives a strict
`bonsaiRelease` from the progression owner: one successfully recorded managed
protected-visit day earns at most one of five non-consecutive release days,
and day 5 owns the first full structural form. Stats/habit evidence shapes
vigor and bounded imprint but cannot block or reduce that structure. Explicit
First Vision, Lab, and progression-debug previews remain read-only.

Recent activation is recoverable appearance, while canonical natural weather
independently owns rain, wind and weather-responsive petals. Neither input
changes the five-day structural release. Seven-evidence-day calibration and
confidence are separate windows. A 30-day calendar-driven post-maturity growth
cycle is not implemented.

There is no bonsai presentation tick. Facts changes create a new request key;
the old materialization becomes ineligible as current truth synchronously, and
the next exact target is committed once.

## Boot Contract

`useZenBonsaiMaterializationRuntime` never hydrates a visual checkpoint.

- Current boot waits for canonical evidence, reconciles and commits the cultivation ledger, then materializes the resulting target exactly once.
- While evidence or the cultivation commit is pending, old life state is not relabelled as current and lineage/render scene sync stays closed.
- First Vision and Lab/read-only inputs materialize their explicit target
  without durable cultivation or lineage writes. The Main progression preview
  may read the current durable identity, but it builds an ephemeral lineage and
  never commits it.
- Any input or scene-mode change invalidates readiness in the same render by exact request-key comparison.
- Current readiness and retained paint visibility are separate. On the same
  physical canvas, scene commit key, and active tree identity, the last exact-ACK
  paint may remain visible while a new input/materialization is prepared. It is
  a presentation latch only: it cannot satisfy the new request, worker/composite
  ACK, boot readiness, First Vision, or progression disclosure, and it closes on
  scene/tree identity or canvas replacement. The next exact ACK replaces it.
- A captured first-viewport frame is scoped to one exact scene generation. A
  `current` capture is discarded when First Vision receives a different
  generation; cross-generation signature convergence is not a valid wait state.
- The worker frame becomes boot-ready only when its scene commit key, input signature, and bonsai materialization key all match the prepared materialization.
- The First Vision conductor advances only after pond and bonsai ACK the same
  scene generation. A current bonsai frame may never satisfy a First Vision ACK.

Candidate topology may be prepared while canonical current evidence is loading
because Classic2 candidate generation is life-state independent. New-target
semantic projection, durable lineage admission, worker scene sync, and
current-frame readiness remain closed until the exact materialization is ready;
the retained-paint latch above does not reopen any of them.

Main hydrates `zen_bonsai_profile_aggregate_v1` before durable Classic2
admission. The renderer remains disabled until the aggregate's exact active
identity and candidate graph have been validated and any newly reached
development records have been committed into its nested lineage. Only the
background bootstrap owner may initialize a physically pristine profile by
installing its reserved epoch and aggregate atomically. Theme/resource runtime
never treats null epoch plus null aggregate as a first-run exception; missing
epoch fails explicitly and an installed epoch without its aggregate or missing
after hydration fails as `ZEN_BONSAI_PROFILE_AGGREGATE_DISAPPEARED`. Reset/import
prepares the next aggregate before mutation and installs it with the exact
reserved epoch in one IndexedDB transaction. A complete
seed/latent/structure/generation-input change uses one identity CAS and clears
the prior lineage atomically; malformed state, stale identity, and same-identity
graph drift throw.

The active identity and nested lineage both carry the exact
`classic2_macro_lineage_graph_v2` contract. Its role-aware descriptor validator
also validates exactly one root, reverse `childIds`, role/depth transitions,
cycle absence, and full root reachability before resolving the graph root or
fingerprint. It is shared by lineage preparation/hydration and the physical
aggregate storage boundary. Durable state contains one macro trunk plus
station-rooted lateral lineage and is capped at 2,400 logical candidates;
render-only topology traversal has a separate 2,448 physical-node cap. Adaptive
trunk spans live only in a branded render binding returned by candidate
preparation. The generator stamps guide shape, physical trunk span count, and a
rounded trunk geometry fingerprint; projection re-walks the current topology
and requires exact node coverage/count, root, guide/geometry/arc, and logical
mapping before consuming that binding. Scaffold root geometry and RNG come from its stable macro global
arc station; the containing span supplies only the current render parent and
local `t`. Classic2 trunk extension likewise uses one continuous global-arc
frontier/integral shared by all physical spans. Changing biological
descriptor/attachment semantics
requires an explicit contract cutover plus the pre-release profile reset.
Changing only physical subdivision must preserve lineage/request/CAS identity;
runtime read repair and legacy-shape rotation are not supported.

The V2 graph contract is paired with profile development baseline `2` because
the articulated-bend/guide-handle cutover may change a stable guide or scaffold
station attachment for the same active input. A baseline-1 profile is routed to
the canonical reset-only recovery before aggregate deep hydration. The exact
cubic control carrier itself is regenerated in the non-persisted render binding;
it is not a new durable candidate-node field.

This durable admission applies only to the current-runtime Home scene.
First-vision/debug/read-only presentation scenes use the same pure lineage policy
in isolated in-memory sessions and never mutate the aggregate. The Experiment
Classic2 surface opens a page-local authoring draft from the active identity and
makes no durable write while editing seed, latent, structure, or learning state.
Only `Apply to Main` commits one complete identity through one aggregate CAS.
Leaving an ephemeral scene clears its committed in-memory lineage before another
scene starts.

The `_v1` suffix is the stable physical slot generation. Because the product has
no released users, Durable Main contains no record-version migration or
historical-policy read path: explicit first-run missing state bootstraps the
exact aggregate contract, valid state reconciles through bounded CAS, and any
other shape fails loudly. Development profiles from before the release V1
baseline use
`docs/operations/runbooks/pre-release-development-profile-reset.md`; runtime
does not clear individual predecessor keys. Missing prepared-candidate
metadata, carrier-fingerprint drift,
corruption, and conflict exhaustion remain fail-loud.

## Current Main-Tab Data Flow

The current home bonsai path starts outside this module and enters through a single facts object.

1. `src/apps/dashboard/hooks/useStatusController.js` resolves dashboard control fields from the stats status snapshot:
   - trust gate: `bonsaiEvidenceReady`
   - score and limit fields: `cycleScore`, `dailyScore`, `dailyDisplayScore`, `dailyScoringMode`, `dailyLimitPercent`, `signalCount`
   - time fields: `daysTracked`, `todayActiveMs`, `todayProtectedMs`, `weeklyProtectedAverageMs`
   - cultivation counters: `activeProtectionDayCount`, `protectedVisitCount`, `frictionSuccessCount`
   - scoring explanation fields: `scoreLedger`, `scoreSummary`, `scoreInsights`
   - site registration fields through `goals.siteLimits` and `blockedList`
2. `src/apps/dashboard/tabs/main/home/HomeScanWorkspace.jsx` converts those controller fields into `bonsaiLifecycleInput`.
3. `src/themes/plugins/zen/widgets/core/ZenCoreStatusClassicHome.jsx` passes `bonsaiLifecycleInput` into the home classic workspace runtime.
4. `src/themes/plugins/zen/runtime/classic/useZenClassicHomeWorkspaceRuntime.js` resolves:
   - `bonsaiMaterializationRuntime` from `bonsai/runtime/useZenBonsaiMaterializationRuntime.js`
   - `bonsaiRenderSystem` from `useZenBonsaiRenderSystem(...)`
   - one production topology, its durable Classic2 lineage projection, and the pond biotic read model through `useZenClassicHomeTopologyRuntime(...)`
   - the generation-and-anchor-only `SakuraHomeSpecies` through `ZenBonsaiHomeSpeciesRegistry.js`; Lab structural A/B and main-thread paint methods are not part of this seam
   - the Home-only worker renderer entry through `useZenHomeTreeRenderer(...)`
   - exact durable lineage readiness before the renderer is enabled

## Experience Model Inputs

`state/ZenBonsaiExperienceModel.js` is pure. It receives only resolved values; it does not read stores, storage, React state, DOM, time, or browser APIs.

`resolveZenBonsaiExperienceModel({ input, lifeState, targetLifeState, currentProjection, targetProjection })`

- `input`: the `bonsaiLifecycleInput` facts object from the dashboard home path.
- `lifeState`: the exact committed life state from `useZenBonsaiMaterializationRuntime`.
- `targetLifeState`: the same exact target life state from `useZenBonsaiMaterializationRuntime`.
- `currentProjection`: the current visual growth projection from `resolveZenBonsaiGrowthProjection({ lifeState, structureDepth })`.
- `targetProjection`: the target visual growth projection from `resolveZenBonsaiGrowthProjection({ lifeState: targetLifeState, structureDepth })`.

`lifeState` is the committed materialized target, not a raw partial input or eased checkpoint.

The model derives:

- `evidence`: normalized facts such as registered site count, data days, protected time, active protection days, protected visits, and friction completions.
- `guaranteedProgress`: baseline growth from registration, days, active time, and protected time.
- `practiceBonus`: vitality-shaping bonus from protected visits, active protection days, friction completions, and weekly protected rhythm.
- `presentation`: user-facing status keys for the compact status seal.
- `diagnostics`: internal trace payload that keeps readiness/cultivation/projection details plus activation-score evidence available without recalculating from the debug UI.

## Experience Model Output

The stable output shape is:

```js
{
  maturity: {
    phase,
    visibleProgress,
    targetProgress,
    guaranteedProgress,
    practiceBonus,
    fullFormReady
  },
  vigor: {
    vitality,
    bloom,
    dryness,
    stress,
    windResponse
  },
  confidence: {
    sampleReliability,
    calibrationProgress,
    baselineReady
  },
  presentation: {
    status,
    sealTone,
    labelKey,
    detailKey,
    progressLabelKey,
    activationPresentation: null | {
      ratio,
      band,
      reliability
    }
  },
  diagnostics: {
    readiness,
    cultivationState,
    evidence,
    currentProjection,
    targetProjection,
    targetLifeState,
    activationDebug
  }
}
```

## Renderer Handoff

`rendering/useZenBonsaiRenderSystem.js` is the adapter between state calculation and the existing classic runtime.

It returns:

```js
{
  experience,
  activationPresentation,
  actionPolicy,
}
```

- `experience` goes to `ZenClassicViewport` as `bonsaiExperience`.
- `activationPresentation` is derived only from the canonical scored habit
  signal and remains ephemeral. It flows through the Main scene snapshot into
  the shared Sakura Canvas/Pixi appearance seam; it never enters lineage,
  candidate identity, cultivation persistence, or terminal birth.
- The only durable Home growth authority is `bonsaiRelease`. Development Home's
  local growth (50–100%) and bloom (0–100%) sliders use the named debug lifecycle
  projection before materialization signature construction. Explicit preview fields
  are admitted only in a debug build's `debug_progression_preview` / `read_only`
  target; release and habit facts remain exact and no cultivation/lineage write is
  admitted. Reset restores live input. Public Home, First Vision, locked scenes and
  named capture profiles do not admit these controls. The Home activation debug
  force remains a separate render-only projection over that one live
  `activationPresentation`. With no forced value it returns the exact live
  object; with a forced value it uses the canonical activation-presentation
  factory and enters the same scene/Sakura handoff. It never writes model state,
  lineage, cultivation, or candidate identity.
- `actionPolicy` goes to `ZenClassicViewport` as `bonsaiActionPolicy`.
- Habit signals remain inputs to the experience/activation model and its debug
  diagnostics. There is no separate feedback/readiness disclosure or portal below
  the Home stage, and the render adapter exposes no footer-only diagnostics DTO.
- Exact materialization commitments stay with the Home runtime's renderer and
  scene-ACK contract; they are not copied into an auxiliary UI output.

The Main drawing path has one topology owner:

- `useZenClassicHomeTopologyRuntime({ bonsaiLifeState, ... })` leaves species unresolved while the canonical profile identity is hydrating. Once candidate preparation is admitted, it validates the exact Home species, generates one candidate topology, projects its durable lineage, and derives the pond biotic signal from that exact visible topology. Hydration `null` is never defaulted to Sakura; a ready unsupported identity still fails loudly.
- `useZenHomeTreeRenderer({ bonsaiLifeState, currentStage, treeTopology, ... })` selects only the Home worker renderer over the shared render-plan/camera core.
- Lab, A/B, and VNext preview surfaces enter through `useZenLabTreeRenderer(...)`; their local/A-B renderer modules are not part of the Main entry closure.
- `widgets/core/ZenBonsaiPreview.jsx` keeps the settings preview runtime behind a nested dynamic boundary so opening Main/Home does not preload its local renderer/species closure.

The experience model controls the main-tab status UI and action policy.
Classic2 geometry is driven by materialized `bonsaiLifeState`, the shared growth
projection, and the persisted lineage decisions materialized by the Classic2
projector. Canvas and Pixi consume that same projected topology and must not
recompute branch selection independently.

Structural time is derived from Classic2 lineage mode. Current Main uses
`durable_main -> persisted_history`, so its wood clock is the monotonic lineage
`maxObservedGrowth`. First Vision uses its immutable `ephemeral_preview`
identity/lineage and therefore cannot observe current history. The Experiment
bonsai lab defaults and resets to Classic2 and uses the same
`ephemeral_preview -> ephemeral_scrub` mapping: its in-memory lineage can contain all decisions
reached at the furthest slider position, while the displayed wood clock is
`min(currentLifeGrowth, maxObservedGrowth)`. This makes backward and forward
scrubbing reversible without rewriting Main history. `classic` remains
an explicit comparison choice, not the lab baseline.

`classic2_wood_presentation_v1` separates local scheduled girth from presented
trunk mass. Trunk width is bounded by one shared progress-knot curve, while
local shoot establishment prevents thin joints; `naturalGirthAge` preserves the
raw schedule and `girthAge` reports the width actually presented. Scaffold
emergence has its own bounded floor. This keeps trunk, branch, and nebari reads
on one traceable projected width instead of repairing mismatches with overlays.

`model/sakura/sakuraRenderer.js` is the single shared Canvas/Pixi nebari owner.
For lineaged Classic2 it derives root reach and root mass from the projected
root `girthAge`, and derives the contact width from the actual projected trunk
width. Pot soil, moss, root toes, and the small soil join are drawn in the BACK
static layer before the tree; the FRONT layer owns only the glazed pot-front
occlusion. Ground branch shadow is optional and does not gate pot or nebari.
Nebari geometry uses the release V1 `nebari_geometry_v1`
identity/morphology/pot-style seed that does not change
with growth or vitality. A separate surface seed adds only moss state and
saturation, allowing the living surface to change without moving the roots.

For Classic2, a born flower carrier is not deleted by current activation.
Activation changes the deterministic bud / half-open / full presentation cohort,
terminal scale/tone/posture, and the bounded render-only frontier bud/blossom
hand-off cue while structural carrier identity and count stay fixed. The
frontier cue is a small, tip-adjacent `half_open` flower only; its visible cohort
is capped and it cannot become a floating full blossom. The cue
does not enter terminal birth metrics or persistence. Pixi rebakes the shared branch rig only when the
bounded activation cohort changes; continuous tint and droop remain runtime
presentation values.

## Action Policy

`state/ZenBonsaiActionPolicy.js` owns user-triggered bonsai actions.

Current behavior:

- reroll is hidden by default.
- reroll becomes visible only when a future explicit grant says it is available.
- development-only reroll can be enabled through `developmentReroll`, but home runtime does not pass that flag.

`useZenClassicHomeWorkspaceRuntime` only forwards `onRerollBonsai` to the viewport when `actionPolicy.reroll.available === true`.
