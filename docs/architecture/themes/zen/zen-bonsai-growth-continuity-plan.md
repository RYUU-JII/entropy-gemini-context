# Zen Bonsai Growth Continuity Plan

- Status: Proposed
- Owner: zen theme architecture
- Last validated against code: 2026-08-19
- Path policy: planning-allowed
- Decision needed: Acceptance of the remaining measured growth-continuity targets; the Classic2 baseline, lineage/clock split, and shared nebari ownership described below are implemented.

Implementation note: G15.4 has replaced Classic2 as the product default. This
proposal now documents the retained Classic2 comparison behavior and historical
continuity targets. Shipping topology ownership is defined by
[G15.4 Product Engine](./zen-g15-product-engine.md); reusable life-state laws
remain in [Zen Bonsai Vitality & Growth Model](./zen-bonsai-vitality-growth-spec.md).

## Why this proposal exists

Classic Zen bonsai already has a slow growth model, a vitality model, and a growth projection bridge. The current visible result still reads too close to a pruned-back mature tree when growth is below full maturity: scaffold and twig presence are present by contract, but sparse enough that flowers often disappear, especially in the classic experiment lab. The target experience is continuous growth from small living sapling to mature bonsai, not a mature bonsai clipped down to early stages.

The implementation must avoid temporary exceptions. Young-stage blossom and twig behavior should be expressed through named model fields and owned boundaries, then verified through matrix captures and contract tests.

## Current state

Canonical generation is fixed by [Zen theme definition](./zen-theme-definition.md):

```text
trunk -> scaffold -> twig
```

The current authority path for the classic lab is:

```text
ExperimentWorkspace synthetic lifecycle input
  -> resolveZenBonsaiLifecycleTarget()
  -> resolveZenBonsaiGrowthProjection()
  -> G15.4 product life-state adapter
  -> typed developmental scheduler graph
  -> G15.4 scene commands
  -> canvas command executor

explicit Classic2 comparison
  -> isolated ephemeral lineage + ephemeral_scrub clock
  -> classic comparison renderer
```

The important current implementation points are:

- `src/apps/dashboard/tabs/experiment/ExperimentWorkspace.jsx` and `src/themes/plugins/zen/runtime/classic/zenClassicWorkspaceRuntimeConfig.js`: lab growth/activation sliders are explicit synthetic lifecycle input; the workspace initializes/resets to `g15_4` and keeps `classic2`/`classic` as explicit comparisons. Classic2 comparison alone uses reversible `ephemeral_scrub` lineage time.
- `src/themes/plugins/zen/model/ZenBonsaiLifecycle.js`: lifecycle target separates maturity/growth from vigor/vitality/bloom.
- `src/themes/plugins/zen/model/ZenBonsaiGrowthProjection.js`: growth projection controls visible depth, length/width scale, scaffold reveal, twig reveal, terminal reveal, and flower gate scale.
- `src/themes/plugins/zen/runtime/classic/useZenClassicAnalysisRuntime.js`: seedling and juvenile display stages currently start from low flower probabilities.
- `src/themes/plugins/zen/model/sakura/sakuraLifeMood.js`: flower presence currently depends on projected growth crossing a fairly late bloom gate.
- `src/themes/plugins/zen/model/sakura/sakuraRenderBranchLayer.js`: terminal rendering applies another growth gate using `lifeGrowth`.
- `scripts/dev/zen-bonsai-growth-snapshot-matrix.mjs`: Playwright harness can capture a growth matrix into `reports/zen-bonsai-growth-matrix`.

The main failure shape is that young growth must pass too many gates before a blossom can be visible:

```text
low stage flowerChance
  * low projection flowerGateScale
  * projectedGrowth bloom gate
  * terminal lifeGrowth gate
  * terminal reveal hashing
```

This makes the desired state hard to see:

```text
growth low, activation high
  -> small tree, high vitality, visible buds or flowers, miniature ramification
```

## Botanical reading

This plan uses horticultural facts as qualitative constraints, not as a literal botanical simulator.

Source observations:

- Japanese flowering cherry produces spring flowers in small clusters at nodes on short spurs, and flowers can appear with new leaves rather than only after a full mature canopy exists. See [Prunus serrulata](https://en.wikipedia.org/wiki/Prunus_serrulata).
- Flowering cherry is an ornamental spring-blooming tree, and dwarf or container-grown flowering cherries are a real horticultural shape. See [How to Plant and Grow Flowering Cherry](https://www.bhg.com/gardening/plant-dictionary/tree/flowering-cherry/).
- Ornamental cherry cultivars are commonly propagated by grafting or selected cultivars, so blossom behavior should not be treated as strictly equivalent to the visual height of a seed-grown tree. See [How to Grow and Care for Japanese Flowering Cherry](https://www.thespruce.com/kwanzan-cherry-trees-2132134).
- Bonsai refinement is built by pruning, wiring, leaf/needle trimming, back-budding, and repeated branch management. Ramification means splitting branches and twigs into finer branches, and in deciduous bonsai it should increase toward branch tips. See [Bonsai cultivation and care](https://en.wikipedia.org/wiki/Bonsai_cultivation_and_care) and [Bonsai aesthetics](https://en.wikipedia.org/wiki/Bonsai_aesthetics).

Model translation:

| Real observation | Entropy visual rule |
| --- | --- |
| Blossoms happen on short spurs/nodes, not only on full-size trunks. | Low growth may allow small bud or blossom terminals when vitality/bloom is high. |
| Young trees can flower sparsely before they look mature, especially when grafted or trained from mature material. | Blossom availability is gated by development floors and bloom vitality, not by final tree size alone. |
| Mature flowering cherry reads dense because there are many branches, short spurs, and a broad crown. | Full growth keeps current mature density as the upper target. Young growth does not receive mature density early. |
| Bonsai ramification is developed over time through repeated growth and pruning. | Twig density grows gradually through named ramification development, not through a one-off depth exception. |
| Bonsai foliage and flowers must stay scale-appropriate. | Young blossoms may be fewer, smaller, and bud-like, even when activation is high. |

Non-goals:

- Do not simulate exact years, seasons, or cultivar-specific flowering age.
- Do not add a calendar phenology system.
- Do not infer real-world botanical health from the user's behavior.
- Do not make all young trees bloom. Low activation should still show sparse leaves or buds.

## Proposal

Adopt a named growth-continuity bridge between lifecycle/projection and Sakura rendering:

```text
slow structural maturity
  -> visible structural development
  -> ramification availability
  -> terminal availability
  -> vitality-driven leaf / bloom expression
```

The bridge should be explicit, deterministic, and monotonic toward the existing full-growth result.

### 1. Keep structural maturity independent from activation

The current test expectation is correct: changing activation must not rewrite structural growth fields such as phase, progress, visible depth, length scale, width scale, trunk reveal, scaffold reveal, or twig reveal.

Activation may affect:

- leaf presence
- flower presence
- bloom openness
- terminal color, wilt, alpha, and scale
- moss and day-close surface feedback

Activation must not affect:

- trunk segment count
- scaffold placement count
- twig depth budget as a direct slider bypass
- stored growth score
- structural milestone stamps

### 2. Add named development channels to growth projection

Extend `ZenBonsaiGrowthProjection` with derived fields that describe visual development, not user input:

| Field | Meaning | Source |
| --- | --- | --- |
| `scaffoldDevelopment` | How much of the scaffold tier is developmentally available. | phase + progress |
| `twigDevelopment` | How much twig ramification is developmentally available. | phase + progress |
| `terminalDevelopment` | How complete leaves/buds/flowers can be at terminals. | phase + progress |
| `bloomDevelopmentFloor` | Minimum biological maturity for flowers when vitality says bloom is high. | phase + progress |
| `miniatureBloomScale` | Young-stage scale cap for blossoms and buds. | phase + progress |
| `ramificationFloor` | Minimum small-tree fine-branch signal when structure is young but living. | phase + progress |

Rules:

- These fields are deterministic functions of normalized lifecycle state.
- They are not read from experiment controls directly.
- They converge to the current mature/display behavior at full growth.
- They are exposed in the snapshot manifest so captures explain why a tree looks the way it does.

### 3. Split generation availability from render presence

A flower cannot render if topology generation never creates a flower candidate. The work must therefore touch two layers:

1. Generation availability:
   - `resolveDisplayGrowthStage()` may set stage flower availability from `lifeState.bloom` plus `bloomDevelopmentFloor`, while preserving small young-stage caps.
   - `applyZenBonsaiGrowthProjectionToStage()` should remain projection-owned and deterministic; it must not read lab controls or raw stats.

2. Render presence:
   - `resolveSakuraLifeAppearanceProfile()` should use a named bloom development gate instead of a single late `projectedGrowth > 0.58` threshold.
   - `sakuraRenderBranchLayer()` should let flower terminal growth use the projection's young-bloom floor and miniature scale, not raw mature flower scale.

This keeps the topology and renderer honest:

```text
candidate flower exists because the tree is biologically capable
visible flower appears because vitality/bloom is currently high
small flower scale remains because structural maturity is still low
```

### 4. Preserve mature baseline

Full growth is the anchor. Implementation should first record baseline captures and then require mature/display snapshots to stay visually and metrically stable.

Expected mature invariants:

- `lengthScale`, `widthScale`, `trunkReveal`, `scaffoldReveal`, `twigReveal`, and `terminalReveal` remain effectively unchanged at display growth.
- Mature high-vitality bloom density does not drop.
- Mature low-vitality strain still expresses through wilt, dry tint, moss, sag, and structural memory, not by erasing the tree.

### 5. Improve young-stage ramification through the smallest owned layer

First attempt:

- Projection and terminal rendering should make existing scaffold/twig candidates read as living miniature growth.
- If generated flower candidates exist but remain hidden, preserve the terminal-bearing scaffold/twig path in `shouldRenderZenBonsaiGrowthNode()` with a named ramification carrier rule derived from `ramificationFloor` and `terminalDevelopment`.
- The carrier rule may reveal existing branch nodes; it must not create synthetic terminals or bypass the deterministic topology.

Only if captures prove candidate shortage:

- Add a named young-stage ramification input to the Sakura generation path through `currentStage.growthProjection`.
- Candidate changes should live in the generation owner, likely `sakuraTopologyPlan`, `sakuraTwigSpawnModel`, or tier runtime params.
- Do not use a lab-only override, random multiplier, or renderer-side invented twigs.

Allowed generator change shape:

```text
growthProjection.ramificationFloor
  -> young scaffold/twig candidate availability
  -> deterministic CRN decisions
```

Forbidden generator change shape:

```text
if experiment lab && growth < 40 && activation > 80
  -> force many twigs / flowers
```

## Growth-Activation Behavior Matrix

The implementation target is this qualitative matrix:

| Growth | Activation | Expected read |
| --- | --- | --- |
| Low | Low | Small sapling, sparse leaves, mostly buds or no flowers, fine growth still alive. |
| Low | High | Small sapling, visible small leaves, sparse bud/flower terminals, early twig/scaffold presence. |
| Mid | Low | Juvenile bonsai, scaffold readable, twig density moderate, flowers limited or faded. |
| Mid | High | Juvenile bonsai, clear ramification, visible blossoms on short spurs and twig nodes. |
| High | Low | Mature structure, health/strain affects leaves and flowers, structure remains dense. |
| High | High | Current full bonsai target: dense scaffold/twig canopy and high blossom expression. |

Important nuance:

- Low growth + high activation is not "full bloom shrunk down".
- It is "small trained tree with a few credible flower sites".
- High growth + low activation is not "small tree".
- It is "mature structure under current strain".

## Retained Classic2 Comparison Adapter

`classic2` is retained as a comparison adapter. G15.4 owns product Home and the
Experiment default; model selection remains owned by the catalog/workspace runtime
config rather than storage, theme IDs, or individual render components.

Scope:

- `classic` remains available as the experiment comparison model.
- `classic2` is an explicit comparison selection, never the Home or Experiment default.
- It does not introduce a new theme id, storage key, user-facing persistent setting, or cross-theme fallback.
- `src/themes/plugins/zen/model/classic2/ZenBonsaiClassic2DevelopmentModel.js` owns deterministic branch birth, maturity, age, terminal-age metadata, and classic2 stage/projection helpers.
- `src/themes/plugins/zen/runtime/classic/zenClassicWorkspaceRuntimeConfig.js` resolves `g15_4` for Home/default lab admission and permits Classic2 only when explicitly selected on an admitted comparison surface.
- Classic2 Experiment comparison uses ephemeral lineage plus `ephemeral_scrub`; it cannot read, advance, or repair a Main product lineage.
- `src/themes/plugins/zen/runtime/classic/useZenClassicAnalysisRuntime.js` composes the selected model with the Sakura candidate topology. For `classic2`, the generated candidate topology stays anchored to the final display form while the projected render topology grows over time.
- Canvas and Pixi renderers consume the projected topology and child visibility metadata; they do not decide the growth model.

The experimental model tests this hypothesis:

```text
candidate topology remains stable
  -> each branch receives deterministic birth/mature milestones
  -> current growth resolves branch age
  -> born branches grow length/width/terminal scale continuously
  -> display growth converges to the existing complete candidate topology
```

Production Classic2 now treats that candidate as the deterministic mature
topology. A typed development-lineage state records every reached parent-causal
candidate; cultivation history cannot retire, block, or delete branches. The
candidate remains the camera, replay, and growth-100 endpoint anchor, while the
lineage remains the durable development-time and observation ledger.

The active lineage record accepts exactly
`classic2_development_lineage_release_v1`. Its
prepared candidate fingerprints both the branch graph and terminal-carrier
metadata. There is no released-user compatibility burden, so the runtime has no
record-version migration or historical-policy read path: missing state receives
a fresh bootstrap, exact-contract state reconciles, and every other shape fails
loudly. Development records remain exact-once during normal reconciliation;
the retained observation score cannot alter membership.

Classic2 wood presentation release V1 is `classic2_wood_presentation_v1`. Trunk
continuation waits for `.16` of parent extension, while scaffold emergence uses
`.08` plus a visible `.14/.065` length/width floor. Trunk extension keeps the
`.42/.48/.99` depth targets, but visible width is now capped by the shared mass
knots `(0,.14)→(.32,.22)→(.40,.29)→(.57,.54)→(.70,.775)→(.85,.895)→(.94,.97)→(1,1)`
rather than by basal segment age alone. Raw local girth remains observable as
`naturalGirthAge`; `girthAge` reports the width actually presented to nebari and
render diagnostics. This avoids the earlier long-thin snake followed by an
abrupt basal mass catch-up without changing the final candidate endpoint.

The juvenile frontier blossom is a bounded presentation handoff, not a terminal
fallback. It exists only through the `.48..72` life-growth window, caps its
keyed visible cohort at `.32`, and draws a small tip-adjacent `half_open` flower.
It cannot become a full floating blossom, alter terminal metrics, or outlive the
  handoff to development-lineage-owned carriers.

Nebari no longer has a second opaque trunk flare or broad root-bed mass. The
shared Sakura renderer derives the four tapered root toes and soil join from
the actual projected trunk/root development. Root reach and mass follow the
root `girthAge`; identity/morphology/pot style own immutable root geometry,
while moss state/saturation use a separate surface seed. Pot soil and nebari
render behind the tree, with only the glazed pot-front occlusion in front.

This is intentionally different from the classic projection path:

```text
classic: generated candidate topology -> projection visibility hides part of it
classic2: generated candidate topology -> branch age decides what has been born
```

## Adoption plan

### Step 0. Baseline capture and metrics

Extend `scripts/dev/zen-bonsai-growth-snapshot-matrix.mjs` before tuning:

- Add a `growth x activation` grid independent of the existing day/scenario matrix.
- Include `growthStage`, `activation`, `lifeState`, `projection`, and stage fields in `manifest.json`.
- Add generated topology metrics:
  - visible branch nodes
  - visible scaffold nodes
  - visible twig nodes
  - generated terminal count
  - generated flower terminal count
  - projected terminal count
  - projected flower terminal count
- Keep per-case PNG output and `matrix.png`.

Run:

```bash
npm run diagnose:zen:bonsai-growth-matrix
```

Expected output:

```text
reports/zen-bonsai-growth-matrix/index.html
reports/zen-bonsai-growth-matrix/matrix.png
reports/zen-bonsai-growth-matrix/manifest.json
reports/zen-bonsai-growth-matrix/report.md
```

The current harness keeps synthetic structural history fixed at activation
`58` for the growth x current-activation grid, so that grid tests presentation
without rewriting branch identity. It also runs two sequential pure-model
development-observation paths. In the 2026-07-12 capture, activation `18/58/92`
kept Classic2 development-lineage membership, visible scaffold/twig counts, and
terminal birth identical at every growth bucket. The two replay paths ended
with runtime-asserted equal lifecycle/projection/identity inputs, `0` of `496`
status differences, `101` observation-provenance differences, and `0%` pixel
difference. That is intentional: lineage observations do not create a hidden
topology effect after the canonical final life-state input is equal. The
manifest stores the equality fields and left/right trace samples. This harness
does not replace the durable repository CAS tests.

### Step 1. Projection contract

Update `src/themes/plugins/zen/model/ZenBonsaiGrowthProjection.js`:

- Add named development fields.
- Update `buildProjectionSignature()`.
- Update `normalizeZenBonsaiGrowthProjection()`.
- Keep existing mature/display values stable.
- Keep activation independence tests intact.

Tests:

```bash
npm run test:file -- tests/themes/zenBonsaiGrowthProjection.test.js
```

### Step 2. Life appearance contract

Update `src/themes/plugins/zen/model/sakura/sakuraLifeMood.js`:

- Replace the single hard `growthBloomGate` with a named helper that accepts `bloomDevelopmentFloor`.
- Preserve vitality, stress, dryness, wither, petal loss, and alpha behavior.
- Keep flower alpha physical: flowers should shrink, wilt, bud, or reduce count before becoming invisible by alpha alone.

Tests:

```bash
npm run test:file -- tests/themes/zenSakuraLifeMood.test.js tests/themes/zenBonsaiGrowthProjection.test.js
```

### Step 3. Stage flower availability

Update `src/themes/plugins/zen/runtime/classic/useZenClassicAnalysisRuntime.js`:

- Make young-stage base `flowerChance` a function of life bloom plus a small development cap.
- Keep seedling and juvenile caps lower than mature caps.
- Do not change structure depth from activation.

Expected effect:

- Low growth + high activation can generate some flower candidates.
- Low growth + low activation remains mostly leaf/bud.

### Step 4. Terminal render gate

Update `src/themes/plugins/zen/model/sakura/sakuraRenderBranchLayer.js`:

- Use projection-provided young bloom development for flower terminal growth scale.
- Use `miniatureBloomScale` to keep young blossoms small.
- Keep `terminalReveal` hashing deterministic.
- Do not invent terminals in the renderer.

Tests:

```bash
npm run test:file -- tests/themes/zenSakuraPreviewTuning.test.js tests/themes/zenBonsaiGrowthProjection.test.js
```

### Step 5. Generator ramification only if needed

Inspect matrix metrics after Steps 1-4.

Proceed to generator changes only if low/mid growth still has too few generated twig candidates.

If generated candidates exist but visible candidates are too low, keep the fix in projection visibility:

- Use `ramificationFloor` and `terminalDevelopment` to reveal terminal-bearing scaffold/twig carrier paths.
- Keep mature/display anchoring stable.
- Do not make activation change structural projection values; activation may affect bloom candidate generation/presence, not the structural owner.

Candidate owner files:

- `src/themes/plugins/zen/model/sakura/sakuraTopologyPlan.js`
- `src/themes/plugins/zen/model/sakura/sakuraTwigSpawnModel.js`
- `src/themes/plugins/zen/model/sakura/sakuraRuntimeParams.twig.js`

Guardrails:

- Keep the 3-pass architecture.
- Keep deterministic CRN decisions.
- Do not add cross-tier recursion.
- Do not read raw experiment controls.
- Add a named `youngRamification` or equivalent policy derived from projection.

Tests:

```bash
npm run test:file -- tests/themes/zenBonsaiGrowthProjection.test.js tests/themes/zenSakuraPreviewTuning.test.js
npm run check:zen:architecture
```

### Step 6. Experiment lab visibility

Update the classic experiment lab only after model behavior is correct:

- Reuse existing synthetic lifecycle input.
- Keep Classic2 as the initial/reset model and legacy Classic as an explicit comparison.
- Use ephemeral lineage with `ephemeral_scrub` so high→low→high slider motion is reversible without mutating Main history.
- Surface projection/debug metrics already computed by the model.
- Do not recompute debug facts from UI refresh.
- Do not persist synthetic lab state as bonsai truth.

This must continue to satisfy [Experiment Debug Boundary Map](../../repository/experiment-debug-boundary-map.md).

### Step 7. Capture and acceptance pass

Run:

```bash
npm run diagnose:zen:bonsai-growth-matrix
git diff --check
```

For model or generation changes, also run:

```bash
npm run test:file -- tests/themes/zenBonsaiGrowthProjection.test.js tests/themes/zenSakuraLifeMood.test.js tests/themes/zenSakuraPreviewTuning.test.js
npm run check:zen:architecture
```

If generator-time ramification changes land, also run:

```bash
npm run check:zen:golden-replay
```

## Acceptance signal

Accept this proposal when all of the following are true:

- Baseline and final captures exist under `reports/zen-bonsai-growth-matrix`.
- The `growth x activation` matrix shows the intended qualitative differences.
- Low growth + high activation has credible small flowers or buds without mature-density canopy.
- Low growth + low activation remains sparse and living, not dead or stump-like.
- Mid growth + high activation shows meaningful twig/scaffold ramification.
- Growth 100 reaches full candidate branch/carrier coverage, candidate length,
  and full root/trunk width in the laboratory viewport rather than normalizing
  against a smaller materialized final state. Scaffold/twig width may differ
  from the raw candidate only through the canonical parent-child taper ceiling.
- High growth outputs retain a legible Classic2 comparison silhouette and
  terminal continuity; legacy `classic` remains comparison evidence, not the
  topology or density target.
- Contract tests prove activation does not rewrite structural maturity.
- `check:zen:architecture` passes without weakening the 3-pass guard.

## Rejection signals

Reject or revise the implementation if any of these happen:

- A lab-only condition changes production rendering behavior.
- Renderer code invents branches, twigs, or terminals that generation did not own.
- Activation directly changes structural depth, trunk segment count, or stored growth.
- Young high-activation trees look like full mature bloom scaled down.
- Mature trees regress in blossom density, scaffold density, overall silhouette,
  or growth-100 candidate coverage.
- Any change bypasses the canonical lifecycle/projection path.

## Related documents

- [Zen Theme Definition](./zen-theme-definition.md)
- [Zen Bonsai Architecture Guards](./zen-bonsai-architecture-guards.md)
- [Zen Bonsai Vitality & Growth Model](./zen-bonsai-vitality-growth-spec.md)
- [Experiment Debug Boundary Map](../../repository/experiment-debug-boundary-map.md)
- [Zen Pond Seam Map](../../repository/zen-pond-seam-map.md)
