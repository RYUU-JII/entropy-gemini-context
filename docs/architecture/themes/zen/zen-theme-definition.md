# Zen Theme Definition

- Status: Active
- Owner: zen theme architecture
- Last validated against code: 2026-08-19
- Path policy: planning-allowed
- Canonical for: Zen theme canon and ownership rules

**Theme Name:** Zen
**Concept:** Japanese Zen Landscape (Karesansui, Chaniwa)

## Core Aesthetics & Keywords
- **Keywords:** Koi, Bonsai, Pond, Bamboo, Ink (Sumi-e), Paper (Washi).
- **Style:** Minimalist, Meditative, Naturalistic but Controlled, Asymmetry, Wabi-sabi.
- **Colors:** Earth tones, Green (Moss/Bamboo), Black/Grey (Ink/Stone), White (Sand/Paper), Subtle accents (Koi fish).

## Creative Guardrails (Default Direction)
- **Prefer Zen-first Landscape Elements:**
    - Avoid English lawns as a default motif.
    - Avoid strongly symmetric geometric flower beds (e.g., French-style layouts) unless intentionally contrasted.
    - Avoid marble statues/fountains unless adapted to Zen context (e.g., traditional bamboo tsukubai).
    - Avoid white picket fences in standard Zen compositions.
    - Avoid overly riotous flower mixes; seasonal accents (Azalea/Sakura/Iris) can be used in controlled compositions.

## Agent Instructions
When creating or modifying components for the Zen theme, follow the Japanese Zen aesthetic as the default direction.
- Use the `Zen` prefix for new Zen-specific components (e.g., `ZenPotRenderer`).
- Ensure visuals preserve a meditative, sumi-e or traditional Zen landscape tone.
- Experimental visual variations are allowed when intent, scope, and rollback path are documented.

## Contract Layers
- **Hard contracts**: determinism/replay, privacy-locality, and tier ownership boundaries.
- **Flexible contracts**: motif mixing, palette nuance, motion language, and narrative expression.
- If a flexible-contract experiment increases product value, keep it behind an explicit flag or isolated variant until validated.
- Pond koi eye-removal trial (2026-10-09): `ZEN_KOI_EYELESS_TRIAL` in
  `src/themes/plugins/zen/pond/model/koi/koiFishRenderBodyCoreMethods.js` hides
  only the paired eye marks. Body, pattern, motion, and shared nudge rendering
  stay unchanged. The intent is to read koi as a mysterious part of the pond's
  energy flow. Visual acceptance is pending; set the flag to `false` to restore
  eyes if the head reads as incomplete rather than intentionally abstracted.
- Zen main special states follow `docs/architecture/themes/zen/zen-main-presentation-scene-architecture.md`: first vision, disabled-by-default recap/reflection events, and the current rolling-pressure view are selected through typed presentation decisions, then expressed through Zen-specific pond, bonsai, graph, overlay, and interaction projections instead of nested component-local booleans.

## Bonsai Generation SPEC (Authoritative)
This section is normative for Zen Sakura bonsai generation and runtime behavior.

### Model scope (reviewed 2026-09-05)

Shipping Home generation and rendering are defined by
[G15.4 Product Engine](./zen-g15-product-engine.md). The Gemini integrator,
fixed trunk/scaffold/twig passes, latent-to-Sakura morphology, and Classic2
candidate/lineage rules below describe the retained Sakura comparison engine;
they do not describe G15.4's typed developmental scheduler. Shared identity,
privacy, model-admission, and owner boundaries still apply to both.

In particular, keeping a canonical Sakura latent in the product aggregate does
not mean it currently drives G15 morphology: the Home compiler and G15's five
consumed phenotype fields are not connected. Current growth, flowering,
`pixi_g15` rendering, and known continuity gaps are documented in the G15 owner
document. Do not use a Classic2 growth contract as evidence that G15 sapling or
flowering continuity has already been implemented.

### Scope
In scope:
1. Trunk/scaffold/twig structural contracts.
2. Deterministic structural RNG and replay guarantees.
3. Trunk policy ownership, angle-guard ownership, and tier boundaries.
4. Required invariants for stage visibility, learning compatibility, and optimization gating.

Out of scope:
1. Pot visual style details.
2. Non-Zen theme rendering systems.
3. Internal model training implementation details beyond externally required contracts.

### Canonical Terms
1. `Trunk Gemini Integrator`: per-segment heading update using `mainCurve + wave + roughness + gravity`.
2. `Trunk micro segment`: one rendered trunk continuation segment.
3. `Scaffold`: structural non-trunk branches (`PRIMARY_BRANCH` / `SECONDARY_BRANCH`) emitted from trunk anchors.
4. `Twig`: terminal fine branch tier (`TERMINAL_TWIG`) that does not rewrite trunk continuation.
5. `CRN`: keyed common-random-number stream derived from structural lineage and decision type.
6. `Classic2 candidate topology`: the deterministic full branch graph generated
   from seed/latent/depth/stage. It defines the complete growth-100 structure
   and camera bounds; durable lineage records when each branch developed.

### Core Contracts
1. Determinism: identical `(seed, latent, structureDepth, stage)` must produce identical topology under the same code version.
2. One-way structure flow: trunk influences scaffold/twig; scaffold/twig never rewrite trunk heading direction.
3. Arc-aware anchoring: scaffold emission is attached from trunk geometry samples, not implicit recursion side-effects.
4. No hidden blends: trunk continuation is single-policy (Gemini integrator only) with no secondary trunk decay/blend path.
5. Privacy and locality: generation, adaptation, and snapshot replay remain local-only.
6. Production development: Zen Home selects `g15_4` through
   `src/themes/plugins/zen/model/ZenBonsaiModelCatalog.js`.
   The promoted typed developmental scheduler consumes the canonical product
   life state and owns the shipping topology plus scene-command projection.
7. Runtime separation: `classic2` and `classic` are explicit comparison models;
   `vnext` is the Research-only engine. None may become a fallback or parallel
   Main topology truth when G15.4 generation fails.
8. Presentation isolation: G15.4 Home derives each product scene from the
   canonical life-state/materialization input. Classic2 lineage remains a
   comparison/diagnostic contract and cannot become an undeclared G15 recovery
   path.

### Latent Single-Source Contract
1. Canonical generative state is latent only.
2. `phenotype` is a derived runtime projection from latent and cannot be authoritative input.
3. Snapshot import/export must carry latent; phenotype-only payloads are invalid.
4. No reconciliation path may prefer phenotype over latent.
5. Release V1 has no phenotype-first recovery or previous-shape bridge; malformed or phenotype-only payloads fail loudly.

### Bonsai Model Roles

| ID | Display | Role | Admission |
| --- | --- | --- | --- |
| `g15_4` | `Main · G15.4 Sakura` | production | Home and Experiment default/reset |
| `classic2` | `Comparison · Classic2` | comparison reference | explicit Home/Experiment comparison |
| `classic` | `Comparison · Classic` | comparison reference | Experiment only |
| `vnext` | `Research · vNext` | research engine | Research only |

Unknown IDs and invalid surface/model pairs throw at the catalog boundary. No
model ID is inferred from another ID's failure.

### Structural Architecture (Fixed 3-Pass)
The Zen Sakura generator must run in fixed passes:

1. `Pass 1: trunk`
- Generate `TRUNK` only.
- Trunk heading update is fixed to Gemini-style segment integration.
- No scaffold/twig emission during trunk recursion.
- Collect scaffold anchors only.

2. `Pass 2: scaffold`
- Evaluate scaffold spawn independently per trunk anchor.
- Generate scaffold branches only (`PRIMARY_BRANCH` / `SECONDARY_BRANCH`).
- No twig emission during scaffold recursion.

3. `Pass 3: twig`
- Evaluate twig spawn independently per scaffold node.
- Generate twig branches only (`TERMINAL_TWIG`).
- Apply terminal leaves/flowers on twig termination and twig-node bloom policy.
- Canonical trunk segment range is `10..200`; recommended operating range is `80..140` for smooth continuity with straight micro segments.

### Latent Control Surface Contract
1. `Structure Axis` top preset is `structure_flow` and must update structure-global keys only.
2. Tier-local style/kink/decay controls belong to `Trunk Tier`, `Scaffold Tier`, `Twig Tier` and must stay decoupled from `structure_flow`.
3. UI sections may route preset source via explicit `presetAxisId`; default fallback remains section `id`.

### Trunk and Geometry Responsibilities
1. `sakuraTrunkGeminiParams` is the authoritative trunk parameter pack for declaration and runtime resolution.
2. Trunk continuation heading must be solved only by the Gemini integrator (`mainCurve`, `waveFreq`, `waveAmp`, `roughness`, `phase`, gravity restore).
3. Trunk segment length uses target height and segment count (`height / segments`) with linear taper by segment index.
4. `SakuraAngleGuardModel` is geometry guardrail only; it must not own trunk morphology policy.
5. Scaffold and twig expansion must respect tier-local depth caps and structural depth caps.

### Scaffold Local-Curve Model (HSMM Turn-Rate) [Canonical]
This section defines the active canonical model for scaffold local node curvature.
The previous scaffold-local additive curve path is removed from scaffold generation.

#### Current Model Rationale
1. Current scaffold local curvature is assembled from multiple additive signals (`curvature*noise*windMemory*straightness`) and then separately mixed with scaffold axis steering.
2. The current additive approach is expressive, but control is indirect: users tune many knobs and still get inconsistent "straight vs sweep vs kink" event frequency.
3. This increases patch-style fixes (caps/guards/special handling) instead of a single consistent generation logic.
4. HSMM turn-rate provides explicit event semantics with deterministic duration, which reduces exception growth while keeping high expressiveness.

#### Model Definition
1. Scope: scaffold local node behavior only. Trunk integrator and twig model remain independent.
2. Core variable: `turnRate` (radians per scaffold node step) as the single local-curve source of truth.
3. Hidden semi-Markov states:
4. `straight`: near-zero turn-rate with small jitter.
5. `sweep`: low-frequency signed bend with persistent direction.
6. `kink`: one-step high turn impulse.
7. `recover`: decay back toward axis target after kink/sweep exit.
8. Semi-Markov rule: each state samples its duration on entry; transition happens only when duration budget expires.
9. Sign handling: `sweep` and `kink` are sign-aware (`left/right`) and may be constrained by side memory.

#### State Emission Contract
1. `straight`
2. Mean `turnRate` near zero, small Gaussian-like jitter.
3. Duration: medium to long.
4. `sweep`
5. `turnRate` follows phase-coherent sinusoidal or OU-smoothed trajectory with fixed sign tendency during one dwell.
6. Duration: medium.
7. `kink`
8. Single-step impulse turn (`kinkAngle`) with explicit sign.
9. Duration: one step (or two at most, controlled).
10. `recover`
11. Exponential decay from previous turn-rate toward zero/backbone target.
12. Duration: short.

#### Transition Contract
1. Transition graph:
2. `straight -> straight|sweep|kink`
3. `sweep -> sweep|straight|kink`
4. `kink -> recover` (deterministic)
5. `recover -> straight|sweep`
6. Transition probabilities are normalized per source state and parameterized by explicit phenotype controls.
7. Duration distribution is explicit and deterministic under CRN keys (`state_enter`, `state_dwell`, `state_transition`).

#### Control Surface (Scaffold Tier)
1. `scaffoldTurnStraightBias` `[0,1]`: base occupancy of `straight`.
2. `scaffoldTurnSweepProb` `[0,1]`: entry probability toward `sweep`.
3. `scaffoldTurnKinkProb` `[0,1]`: sparse kink event probability.
4. `scaffoldTurnSweepAmpDeg` `[0,24]`: sweep amplitude.
5. `scaffoldTurnSweepFreq` `[0.2,2.4]`: sweep phase advance rate.
6. `scaffoldTurnKinkAngleDeg` `[4,36]`: one-shot kink impulse size.
7. `scaffoldTurnRecovery` `[0,1]`: recovery damping strength.
8. `scaffoldTurnPersistence` `[0,1]`: average dwell duration scale.
9. `scaffoldTurnNoise` `[0,1]`: in-state jitter intensity.
10. `scaffoldTurnDepthDamping` `[0,1]`: damping toward tip depth.

#### Integration in Current Pipeline
1. Keep fixed 3-pass architecture unchanged.
2. Keep scaffold axis planner (gravity/wind/root angle) as global direction prior.
3. Replace scaffold local curve synthesis path:
4. Remove scaffold use of generic additive `resolveSakuraCurveState` as primary local turn source.
5. Add `sakuraScaffoldTurnRateModel` to generate per-node `turnRate` + debug state label.
6. In scaffold continuation, combine:
7. `absoluteAngle = axisTargetAngle + hsmmLocalOffset`
8. Node `curve` is derived from the same `turnRate` (single-source local curvature).
9. `shapeMode` continues to affect length/width profile only, not local turn event selection.
10. Trunk and twig code paths do not depend on HSMM internals.

#### Deterministic RNG Contract Additions
1. All HSMM events must use keyed CRN streams from scaffold lineage.
2. Required decision keys:
3. `scaffold_hsmm_state_init`
4. `scaffold_hsmm_state_transition_{step}`
5. `scaffold_hsmm_state_duration_{step}`
6. `scaffold_hsmm_emission_{step}`
7. No `Math.random` in HSMM path.

#### Expected Effects
1. Explicit and stable frequency control for `straight/sweep/kink` morphology events.
2. Fewer ad-hoc per-depth exception rules because event logic is centralized in one state machine.
3. Better controllability for users and optimizer: morphology knobs map to visible event frequencies.
4. Higher replay stability: state durations and transitions are deterministic under CRN.
5. Easier diagnostics: each scaffold node can expose `hsmmState`, `turnRate`, and `dwellRemaining`.

#### Current Implementation
1. Scaffold-local additive curve synthesis is absent from scaffold continuation.
2. Scaffold heading local offset and node curve are both sourced from HSMM turn-rate.
3. HSMM scaffold controls are canonical scaffold-tier phenotype keys.

#### Acceptance Criteria
1. Build and Zen generation tests pass.
2. Under fixed seed, replay is identical before/after repeated runs with HSMM enabled.
3. Measured state occupancy follows configured bias bands:
4. high straight bias -> dominant `straight`
5. high sweep prob -> increased sweep dwell ratio
6. high kink prob -> sparse but measurable kink frequency without runaway zigzag
7. Scaffold local curvature no longer requires depth-specific exception patches to express straight/sweep/kink mixes.
8. Trunk and twig outputs remain policy-isolated from scaffold HSMM internals.

### Spawn Decision Rules
1. Scaffold spawn is trunk-anchor driven and gated by trunk depth banding, minimum scaffold depth spacing, width signals, and scaffold-strength signals.
2. Twig spawn is scaffold-node driven and gated by scaffold depth/width signals, twig branching signals, and per-node independent probabilities.
3. Non-emitted scaffold/twig nodes may terminate, but termination does not trigger cross-tier recursion conversion.
4. Twig silhouette density uses semantic `branchOrder` and role-local scaffold/twig depth only. Adaptive trunk span count and traversal depth are not twig sampling or budget coordinates.
5. Crown negative space is expressed by admitting fewer complete ramified twig clusters and releasing the exact apex budget; it must not starve every cluster into continuation-only chains or monotonically pack more nodes toward the apex.

### High-Risk Anti-Patterns
The following are high-risk in canonical mode and should be avoided unless accompanied by an explicit RFC and regression tests:

1. Single recursive architecture that transitions `TRUNK -> SCAFFOLD -> TWIG` in-flight.
2. Depth-driven order switching inside one recursion path as the primary tier transition mechanism.
3. Double trunk policy (Gemini integrator + additional trunk decay/backbone blend) in the same continuation path.
4. Backdoor randomness (`Math.random`) in canonical structural generation paths.
5. Mixing feasibility gates directly into reward calculations instead of explicit gate checks.

### Deterministic RNG Contract
1. Structural decisions must use keyed CRN streams.
2. Key components must include seed and structural lineage (`parent/node slot/decision type`).
3. Decision ordering changes must not break deterministic replay guarantees for unchanged keyed calls.

### Stage, Learning, and Optimization Compatibility
1. Stage controls visual expression and terminal visibility behavior; it must not invalidate learned structural state.
2. Canonical A/B attribution pairs must preserve intervention isolation semantics: both candidates share one structural seed, and ordinary coverage questions change exactly one tracked latent factor. Cross-trial or cross-seed candidate lattice pairs are diagnostic only and must not become training questions.
3. Hard feasibility constraints remain gate conditions, not reward additives.
4. Optimization unlock and runtime gating must remain diagnostics-driven and deterministic-replay safe.
5. Factor coverage counts only decisive, same-seed, single-factor isolation questions. Multi-factor Sobol pairs remain discovery questions and do not claim per-factor attribution.
6. The pairwise GP random-feature projection is stationary for a model-state version. Learned axis relevance is diagnostic metadata and must not rescale the active projection after feedback.
7. Predictive AUC/ECE uses the displayed A/B probability captured before feedback. Candidate singleton scores are diagnostic-only inputs, not reliability-gate evidence. Persisted prediction records require the current explicit model contract.

### Acceptance Criteria
1. Build succeeds.
2. Same snapshot payload replays to the same topology under identical runtime/version.
3. Trunk continuity metrics do not regress after structural refactors.
4. Scaffold vertical occupancy and side balance stay within intended operating ranges.
5. Twig density remains controllable by dedicated twig/scaffold spawn controls without reintroducing tier-transition recursion.

### File Responsibility Map
1. `src/themes/plugins/zen/model/sakura/sakuraBranchGenerator.js`: 3-pass orchestration only (trunk -> scaffold -> twig).
2. `src/themes/plugins/zen/model/sakura/sakuraPassContextFactory.js`: pass input assembly and shared runtime/model wiring.
3. `src/themes/plugins/zen/model/sakura/sakuraTrunkPass.js`: trunk pass execution.
4. `src/themes/plugins/zen/model/sakura/sakuraScaffoldPass.js`: scaffold pass execution.
5. `src/themes/plugins/zen/model/sakura/sakuraTwigPass.js`: twig pass execution.
6. `src/themes/plugins/zen/model/sakura/sakuraPassContracts.js`: pass I/O runtime contracts (dev assert).
7. `src/themes/plugins/zen/model/sakura/sakuraTierModelRegistry.js`: tier-separated model registry (trunk/scaffold/twig).
8. `src/themes/plugins/zen/model/sakura/sakuraRuntimeParams.global.js`: global runtime param resolver.
9. `src/themes/plugins/zen/model/sakura/sakuraRuntimeParams.scaffold.js`: scaffold runtime param resolver.
10. `src/themes/plugins/zen/model/sakura/sakuraRuntimeParams.twig.js`: twig runtime param resolver.
11. `src/themes/plugins/zen/model/sakura/sakuraAngleUtils.js`: angle math helpers for pass-local continuity.
12. `src/themes/plugins/zen/model/sakura/sakuraRandomUtils.js`: deterministic RNG accessor utility.
13. `src/themes/plugins/zen/model/sakura/sakuraBranchNodeFactory.js`: branch node construction policy.
14. `src/themes/plugins/zen/model/sakura/sakuraBranchHeuristics.js`: tier-local heuristic helpers (depth context, attach, twig count).
15. `src/themes/plugins/zen/model/sakura/sakuraScaffoldShapeModel.js`: scaffold backbone/profile/side/root-angle modeling helpers.
16. `src/themes/plugins/zen/model/sakura/sakuraTwigCurveFlow.js`: twig harmonic curve-flow state model.
17. `src/themes/plugins/zen/model/sakura/sakuraTwigSpawnModel.js`: scaffold-to-twig spawn/resource model.
18. `src/themes/plugins/zen/model/v2/SakuraLatentTierRegistry.js`: canonical latent tier grouping registry.
19. `src/themes/plugins/zen/model/v2/SakuraLatentParamApi.js`: key/definition access API for learning and controls (schema decoupling layer).
20. `src/themes/plugins/zen/model/v2/SakuraLatentTierCompilers.js`: tier-specific latent -> phenotype compilers.
21. `src/themes/plugins/zen/model/sakura/sakuraTrunkGeminiParams.js`: trunk parameter set declaration and runtime resolver.
22. `src/themes/plugins/zen/model/bonsai/generation/SakuraAngleGuardModel.js`: geometric guards and bend constraints.
23. `src/themes/plugins/zen/model/bonsai/generation/growthDecayPolicyModel.js`: tiered length/width decay policy (scaffold/twig).
24. `src/themes/plugins/zen/model/SakuraSpecies.js`: topology assembly orchestration.
25. `src/themes/plugins/zen/model/sakura/sakuraScaffoldBranchEmitter.js`: scaffold continuation recursion core.
26. `src/themes/plugins/zen/model/sakura/sakuraTwigBranchEmitter.js`: twig continuation recursion core.
27. `src/themes/plugins/zen/model/sakura/sakuraTwigSilhouettePolicy.js`: role-local crown negative-space, root opening, and open-fork policy independent of trunk subdivision.

### Source of Truth
1. Shipping G15.4 owner: `docs/architecture/themes/zen/zen-g15-product-engine.md` and `src/themes/plugins/zen/model/bonsai/g15/ZenBonsaiG15Species.js`.
2. Retained Sakura comparison generation: the model-scoped contracts in this section and `src/themes/plugins/zen/model/sakura/sakuraBranchGenerator.js`.
3. Future refactors should preserve core contracts in this section. A post-public contract change requires a separate architecture decision and matching tests.
