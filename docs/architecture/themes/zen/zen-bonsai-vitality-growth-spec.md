# Zen Bonsai Vitality & Growth Model

- Status: Active
- Last validated against code: 2026-10-11
- Owner: zen theme architecture, stats scoring
- Path policy: planning-allowed
- Replaces: goal-ratio credit scoring in `scoreLedger.js` as the bonsai health driver;
  near-symmetric daily caps in `ZenBonsaiCultivationLedger.js`
- Canonical for: qualified-use release age versus cultivation appearance,
  cultivation values, limit-time authority split, bonsai health/growth state
  laws, daily outcome computation, structural imprint, tier presentation
contract

Product topology is owned by Plume. The cultivation/life-state contracts in
this document remain canonical inputs to that engine; G15.4 and Classic2 lineage
and wood projection sections apply to explicit comparison and diagnostic paths. See
`docs/architecture/themes/zen/zen-g15-product-engine.md` for the shipping model
boundary.

Current public release (2026-10-11): Home structural release starts
at life-state growth `0.5` and reaches `1` after five qualified-use days. It is
separate from recent activation and natural weather; the seven-evidence-day
calibration/confidence windows remain separate. A 30-day calendar-driven
post-maturity growth or seasonal cycle is not implemented.

G15.4 comparison integration review (2026-09-05): structural release is
separate from cultivation stock/health. G15 converts that value into an event
budget and derives the current graph; it does not yet consume this document's
persisted structural imprint/stamped growth segments as G15 developmental
history. Its default flower presentation now uses stable wood stations,
seeded organ births and local age, with bloom controlling presence and opening.
This replayable presentation is not a persisted seasonal bud-to-flower lifecycle. The paragraphs below describing
Classic2 lineage, milestones, dew, leaf fall, and imprint must not be treated as
proof of equivalent G15 behavior. Current wiring gaps and evidence are recorded
in the [G15 product owner](./zen-g15-product-engine.md).

The G15 clock/interpolation and causal-organ patches keep that release policy
intact while separating completed growth, a pending event, product maturity and
individual organ age. Dryness now affects small vegetative-bud tones; broader
G15 activation and recovery remain future work. The proposed
[G15 development roadmap](./zen-g15-development-roadmap.md) treats morphology as
neutral character, structural age as development, and activation as recoverable
appearance. Habit-to-morphology mapping remains a future decision; it is not
implied by the existing cultivation tier contract or the adopted five-day release.

Progression supplies strict `bonsaiRelease`; five non-consecutive qualified-use
days own structural age and day 5 owns the first full form. The cultivation model
and comparison wiring described on 2026-07-22 remain implemented
(`ZenBonsaiVitalityModel.js`, release V1 cultivation ledger, score ledger dual
references, status read-model `dailyOutcome`), and milestone/recovery growth
events reach the classic growth-tip projection. Day-close surface feedback also
flows through projection into the classic renderer: dew/leaf-fall cues and
discrete moss tier states are implemented as visual bridge passes. Consume-once
ceremony state remains follow-up work. Structural imprint is now persisted in
the cultivation ledger, updated on closed post-calibration days, threaded
through TargetModel/Lifecycle, and blended into projection bridge fields before
classic branch projection consumes them. A first per-milestone stamped-segment
ledger is part of the release V1 cultivation contract and consumed by growth
projection. Classic2 now also owns a versioned development-lineage state:
every reached parent-causal candidate branch is recorded exactly once, and its
bounded history observation provenance is stored in the typed Zen model-state
store before Main rendering is admitted. Habit history cannot retire, block,
or otherwise remove candidate topology.
The separate versioned wood-presentation schedule then derives shoot emergence,
extension, girth, and terminal carriers from that state using persisted
`maxObservedGrowth` for Home or the bounded current-life scrub clock for the
Experiment lab; current activation remains an ephemeral appearance and bounded
branch-rig bake input.
The single durable current-tree entry is now
`zen_bonsai_profile_aggregate_v1`. It co-locates the complete active identity
(seed, canonical latent, structure, canonical generation inputs, and
`identityRevision`), identity fingerprint, nested lineage, `stateRevision`, and
top-level durable `profileEpoch`. The profile epoch is stamped from the reserved
ModelState reset-epoch row and is compared in the same IndexedDB transaction as
every aggregate bootstrap/CAS. The nested lineage accepts exactly
`classic2_development_lineage_release_v1`. Its retained Classic2-owned scoring
seam records apical continuity, local clearance, parent support, sibling demand,
history mismatch, side mass, and terminal-carrier potential as observations;
those values do not control admission. The prepared candidate supplies
fingerprinted terminal-carrier metadata. Durable Main has no record-version
migration or historical-policy interpretation: only extension-lifetime
first-run may bootstrap a missing aggregate; a `null` lineage inside a valid
aggregate materializes the exact nested release contract; an exact lineage
reconciles through bounded CAS; and every other shape fails loudly. A different
prepared identity commits one complete
identity through one aggregate CAS, advances identity/state revision once, and
clears the prior lineage atomically. The next lineage commit is admitted only
against that exact active identity.

## Intent

The current model scores adherence against a raw self-set goal and grants
credit inversely proportional to usage ratio, so a loose goal produces free
daily credit, and same-day credit fully offsets deductions (no memory). The
bonsai therefore neither persuades nor teaches.

This spec separates the tree into two coupled state variables whose mechanics
match the metaphor:

- **Growth `G`** (stock): slow, cumulative, earned by practice while healthy.
  Bad periods pause growth; only extended neglect causes bounded dieback.
- **Health `H`** (flow): reflects the last ~3–7 days. Damage shows within a
  day; **full recovery requires 4 consecutive exemplary days**. Recovery
  *signs* are visible from day 1.

Persuasiveness comes from the asymmetry being explainable as "it is a tree",
not as arbitrary balancing.

## Cultivation Values (Normative Contract)

Product maxim:

```text
우주의 법칙이 자유의지를 밀어낸다면, 난 최선의 의지를 자유의지라 부르리라.
```

The bonsai must model **best available will under constraint**, not pure
abstinence, moral purity, or obedience to an app-authored ideal. It should make
reflection unavoidable enough to matter, while avoiding punishment, guilt, and
hidden moral judgment.

The system may infer evidence. It must not infer the user's worth, virtue, or
true internal motive.

### What counts as exemplary

| Value | Counted as strong evidence | Not counted as strong evidence |
| --- | --- | --- |
| Evidence-bearing intention | A configured limit on a domain the user actually encounters, followed by usage below the credit reference or honored friction. | Editing a limit, registering a dead domain, or setting a loose target with no behavior change. |
| Contact with friction | Encountering a protected surface and accepting a pause, cool-down, early exit, or delayed return. | Avoiding all protected surfaces and treating absence as mastery. |
| Sustainable reduction | Moving below the personal baseline by a plausible amount, then repeating it long enough to survive normal variance. | One impossible hard-reset day followed by collapse, or self-punitive targets presented as moral success. |
| Recovery | Returning after a slip, making the next day smaller, or honoring friction after overuse. | Erasing the slip, hiding it behind averages, or making damage permanent. |
| Honest calibration | Letting the app learn before asking for strong claims, and accepting tentative posture labels. | Treating 1-7 days of data as a stable identity. |
| Agency | The user owns runtime commitments; the app explains growth credit separately. | The app silently replacing the user's limit with an invisible ideal cap. |

### What must stay neutral

Some states are meaningful but not exemplary:

- **No configured managed domains**: quiet mode. The bonsai drifts toward
  steady and does not grow structurally.
- **Configured but inactive domains**: observation only. Registration proves
  intent, but lack of exposure proves neither success nor failure.
- **Very low usage because the domain is irrelevant**: neutral. The tree should
  not praise unused temptation.
- **Optional artifacts disabled** (`shishi-odoshi`, `furin`, koi cooling, etc.):
  the model must still find process evidence through broader protection
  outcomes when they exist. Optional ceremonies amplify texture; they are not
  the only path to practice credit.

This is the core anti-gaming rule: **absence is not failure, but absence is not
growth.** Growth requires contact with the thing being cultivated.

### Language and affect

All user-facing copy and diagnostics must speak in terms of:

- signal, evidence, posture, strain, recovery, calibration, and momentum

They must not speak in terms of:

- bad user, laziness, shame, virtue, punishment, obedience, or purity

The tree can look strained. It should never accuse. A visible kink, sag, or
leaf-fall event is a record of conditions, like weather in wood, not a verdict.

## Limit-Time Governance (System Contract)

The product contract is:

```text
The user declares intent. The app respects that intent for runtime friction.
The bonsai only rewards evidence of real change.
```

This keeps Entropy from becoming an automatic time-diet authority while also
preventing an easy self-set goal from becoming free growth.

### Authority split

Limit time is not one value. It has several related meanings owned by different
layers:

| Concept | Owner | Storage/source | Meaning | Must not do |
| --- | --- | --- | --- | --- |
| `declaredGoalMinutes` | user + Rules settings | `globalGoal`, `siteGoals` | The user's stated commitment and visible rule label. | It must not by itself grant bonsai growth. |
| `runtimeLimitMinutes` | protection runtime | normalized settings snapshot | The line where friction, global cap, warnings, or reinforcement can activate. | It must not be replaced by a hidden app-computed cap. |
| `creditRefMinutes` | stats scoring lens | `min(declaredGoal, B)` when baseline is available | The threshold for positive daily adherence. | It must not grow merely because the user loosens the goal. |
| `deductRefMinutes` | stats scoring lens | `max(declaredGoal, min(0.70 * B, 2 * declaredGoal))` when baseline is usable | The threshold used to judge overuse damage. | It must not punish usage inside the user's stated goal or normalize an arbitrarily high history. |
| recommendation/posture | Sites/status read model | derived from baseline confidence + declared goal | UX guidance: stretch, maintenance, loose, calibrating. | It must not be a second source of settings truth. |

The settings layer stores what the user chose. The stats lens interprets that
choice against observed behavior. The bonsai consumes only the interpreted
daily outcome.

### Baseline authority and confidence

The canonical behavior baseline is `B`: the median of the common robust
managed-usage profile over the trailing 28-day window ending yesterday. It
uses engaged days only and delegates distribution math to the stats personal
baseline core (`usageBaseline.js`).

Do not switch scoring formulas from 7-day to 14-day to 28-day averages as data
accumulates. That creates invisible semantic jumps. Instead:

- Use one 28-day trailing kernel from the start.
- Include only engaged sample days.
- Keep the observed distribution unweighted; recency belongs to a separate
  `recent_trajectory` projection.
- Retain outliers in the observed distribution and use robust median/MAD/IQR
  statistics rather than a second usage-specific clipping algorithm.
- Increase confidence as sample count grows.

This makes the effective period grow naturally with evidence while preserving
one source of truth. A 7-day recent average may exist only as trend annotation,
not as the scoring or cap authority.

Recommended baseline metadata:

| Field | Meaning | Owner |
| --- | --- | --- |
| `stats.median` | common robust center used for `B` | stats baseline profile |
| `sample.eligibleCount` | engaged days used inside the 28-day window | stats baseline profile |
| `status` / `confidence` | evidence maturity and numeric confidence | usage baseline adapter / stats baseline profile |
| `recentTrend` | optional completed-activity-day trajectory for copy only | `rollingPressureModel` projection |

Recommended confidence vocabulary:

| State | Evidence | Product meaning | Scoring use |
| --- | --- | --- | --- |
| `sparse` | 0-2 engaged sample days | Ask the user for a starter commitment; show evidence-building copy. | Explicit `normative_only`; bonsai health remains calibration-neutral. |
| `forming` | 3-13 engaged sample days | Pattern is usable but still sensitive to unusual days. | Bounded dual-reference scoring; recommendations remain soft. |
| `stable` | 14+ engaged sample days | Stable enough for stronger guidance and debug assertions. | Full dual-reference scoring; warnings may be stronger. |

Numeric confidence comes from the common profile's evidence components; UI
must consume it rather than derive another sample-count curve. It affects copy,
recommendation emphasis, and diagnostics only; it must not multiply the user's
stored goal or create a second scoring path.

The current implementation always returns the configured rule's explicit
profile, including `sparse`; `scoreRuleReference.js` decides whether the goal
remains `normative_only` or the observed profile is usable. If the UI exposes
confidence, it must read the profile fields and must not recompute facts in the
dashboard.

### Goal posture and recommended thresholds

When baseline `B` is available, each declared goal can be classified for UX and
debugging. These labels describe the promise, not the user's worth.

Recommended posture thresholds:

| Posture | Rule | Interpretation | Bonsai implication |
| --- | --- | --- | --- |
| `calibrating` | no usable `B` | The app cannot yet compare this goal to real behavior. | No baseline-based judgment; health stays neutral during cultivation calibration. |
| `hard_reset` | `goal <= 0.60 * B` | A severe cut. Potentially useful, but likely fragile. | Allow it, but copy should warn that the tree rewards progress rather than instant perfection. |
| `stretch` | `0.60 * B < goal <= 0.75 * B` | Ambitious reduction below the current norm. | Credit requires meeting the stretch; damage is softened by `deductRef`. |
| `reducing` | `0.75 * B < goal <= 0.90 * B` | Best default improvement zone. | Strong candidate for growth when followed. |
| `maintenance` | `0.90 * B < goal <= 1.10 * B` | Roughly current behavior. | Usually neutral unless usage beats `creditRef` or practice evidence exists. |
| `lenient` | `1.10 * B < goal <= 1.25 * B` | Easier than current pattern but still close enough to be a first step. | Runtime rule is respected; growth credit still requires beating `B`. |
| `loose` | `1.25 * B < goal <= 1.60 * B` | Too permissive to count as meaningful restraint. | No free growth; surface gentle guidance. |
| `observation_only` | `goal > 1.60 * B` | Mostly a warning/observation line, not a restraint. | Do not reward merely staying under it. |

Why these numbers:

- `0.75-0.90 * B` is the recommended improvement band. It asks for a visible
  change without turning the first target into a punishment engine.
- `0.60 * B` is the lower "hard reset" boundary. Below that, user intent is
  still respected, but copy should frame it as difficult and recovery-based.
- `1.10 * B` is the top of maintenance. Day-to-day noise around a personal norm
  often lives inside roughly ±10%.
- `1.25 * B` is the lenient warning threshold. It is far enough above normal
  variance to avoid nagging, but low enough to catch goal inflation before it
  becomes free permission.
- `1.60 * B` is the observation boundary. At ~60% above baseline, the rule can
  still trigger runtime friction, but it should not be represented as a growth
  target.

Any "recent-week average * multiplier" idea should be interpreted as an example
of goal-inflation detection, not as policy. The recommended policy is:

- Use `1.25 * B` as the durable lenient-goal warning threshold once status is
  `stable`.
- If status is `sparse` or `forming`, avoid strong labels; surface
  "still learning your pattern" copy instead.
- If a 7-day recent average is exposed, use it only to explain trend direction,
  e.g. "this week is higher than your usual pattern." Never use it as a max cap
  and never use it to override `B`.
- Never reject a user-entered limit solely because it is above a threshold. A
  loose rule can still be useful as a friction line, a first step, or a harm
  reduction commitment.

Recommended target suggestions require a `stable` baseline:

| Option | Suggested value | Meaning |
| --- | --- | --- |
| Hold steady | `1.00 * B` | Preserve current behavior; growth requires beating the norm or honoring friction. |
| Gentle reduction | `0.85 * B` | Default recommendation. Meaningful but not dramatic. |
| Strong reduction | `0.75 * B` | Ambitious but still inside the normal growth model. |
| Reset | `0.60 * B` | Explicit hard-mode target; use cautious copy. |

Suggested values should be rounded to a humane editing step (5 minutes for
targets under 2 hours, 10-15 minutes for larger targets). Rounding is UI-only;
the stats lens reads the stored minutes as authored.

### Rules UI contract

Rules UI may recommend target ranges, but must keep user agency clear:

- The user can enter or keep a limit inside the existing normalized settings
  range (`globalGoal`, `siteGoals`).
- The UI should distinguish "runtime limit" from "growth credit target" in
  copy and diagnostics.
- A loose goal should be allowed with guidance, not silently rewritten.
- A very low goal should be allowed with guidance, but the damage reference
  must remain gradual
  (`deductRef = max(goal, min(0.70 * B, 2.00 * goal))`) so one aspirational edit
  does not immediately wither the tree or make the baseline an unbounded
  substitute for the authored goal.
- Editing a goal is not practice evidence. Only usage and friction outcomes
  affect `dailyOutcome`.

Recommended copy direction:

| Situation | Preferred meaning | Avoid |
| --- | --- | --- |
| Loose goal | "This can still trigger friction, but growth asks for less than your recent norm." | "Invalid goal" |
| Very low goal | "Ambitious; the tree will look for steady progress rather than instant perfection." | "Failure expected" |
| No baseline | "Collecting your pattern before judging growth." | "No data, using default truth" |
| Maintenance target | "Good for holding steady; growth comes from beating the pattern or honoring friction." | "Healthy by default" |

### Scoring, protection, and bonsai contract

1. Protection/runtime decisions use `runtimeLimitMinutes`, derived from the
   user's current settings. This preserves visible agency.
2. Stats scoring builds `creditRef` and `deductRef` from the current policy lens
   and durable facts. This is the anti-gaming layer.
3. `dailyOutcome` is the only bridge into bonsai vitality. Bonsai code must not
   read `globalGoal`, `siteGoals`, `recentTrend`, or raw facts directly to
   reinterpret goal leniency.
4. During calibration, missing baseline confidence must produce explicit
   calibration/neutral behavior, not a hidden fallback to a magic app target.
5. Goal-posture diagnostics are read-model output. They may inform UI, copy,
   tests, and debug panels, but they do not become persistent settings.

### Anti-gaming rules

- Raising a goal above baseline can reduce runtime interruptions, but it cannot
  create bonsai growth unless actual usage beats the credit reference.
- Lowering a goal below baseline can create a clear intention, but damage is
  evaluated against the gradual deduction reference so the app does not punish
  ambition immediately.
- Repeated goal edits do not rescore previous days. Closed-day outcomes remain
  tied to the policy/facts lens used when the day closed.
- A single blowout site cannot be averaged away by many small compliant rules.
- Non-engaged days drift; they are not success days.

## 1. Daily outcome `d`

Computed once at day close (existing CultivationLedger daily rollup point),
`d ∈ [−1, +1]`.

### 1.1 Adaptive reference (kills the loose-goal exploit)

Per rule (global goal, each site limit):

```text
B         = robust baseline of daily managed usage minutes on engaged days
            (unweighted 28d trailing window ending yesterday;
            common robust median — see usageBaseline.js)
creditRef = min(goalMinutes, B)          // reward beats your own norm
deductRef = max(goalMinutes, min(0.70 · B, 2 · goalMinutes))
                                            // respects goal; bounds historical relief
```

Split references (implementation refinement over the original single effRef —
a single band either hands typical days free credit or deducts inside the
stated goal):

- **Credit** requires beating the stricter of goal/baseline: a typical day at
  your own norm is neutral, never a plus — regardless of how loose the goal
  is. This is what actually kills the "1h goal, 30min usage, +every day"
  exploit.
- **Deductions** run against the looser of goal/`0.70·B`: an aspirational (or
  mistyped) goal far below current behavior demands improvement gradually;
  usage inside the stated goal is never deducted just for exceeding the norm.
- No baseline yet (< 3 engaged sample days): both references use the raw goal,
  matching the release V1 calibration grace period.

### 1.2 Per-rule adherence

```text
usage ≤ 0.95 · creditRef                  → a = +1   (flat, no extra for headroom)
0.95 · creditRef < usage ≤ 1.15·deductRef → a = 0    (neutral band)
1.15 < rD ≤ 1.50                          → a = 0 → −0.6    (linear, rD = usage/deductRef)
1.50 < rD ≤ 2.00                          → a = −0.6 → −1.0 (linear)
rD > 2.00                                 → a = −1.0
```

Aggregate `a` = exposure-time-weighted mean over rules with activity;
if any rule has `r > 1.5`, `a = min(a, that rule's value)` — a blowout on one
site cannot be averaged away.

### 1.3 Exposure gate (credit requires tension)

A day is **engaged** iff ≥ 5 active minutes on managed sites or ≥ 1 protected
visit. Non-engaged days are **neutral**: no credit, no damage (see drift law).
Overuse always implies engagement.

### 1.4 Practice `p` (process over outcome)

```text
p = min(1, ritualCount / 2)
ritualCount = today's friction successes (koi cooling, shishi-odoshi pour,
              terminus brake honored)
            + early-stop events (left a protected site with ≤ 85% of
              `creditRef` consumed, or ≤ 85% of declared goal while no
              baseline exists, and no return within 30 min)
```

These are effortful acts already collected via `frictionSuccessCount` /
`protectedVisitCount`; they cannot be gamed by editing a settings number.

Implementation note: v1 counts today's friction successes
(`todayFrictionSuccessCount` in the status read model). Early-stop detection
needs session-level analysis and is future work.

### 1.5 Combination

```text
engaged day:  d = clamp(0.7·a + 0.3·p, −1, +1)
neutral day:  d is not produced; drift law applies
```

## 2. Health `H` — asymmetric integrator

Persisted in CultivationLedger release V1, range `[0.12, 1.0]`, initial 0.68.

```text
engaged, d > 0:  H ← H + 0.42 · d · (1 − H)         (recovery)
engaged, d < 0:  H ← H + 0.25 · d · (0.30 + H)      (damage; d negative)
engaged, d = 0:  H ← H + 0.04 · (0.68 − H)          (maintenance settles slowly)
absent/neutral:  H ← H + 0.08 · (0.68 − H)          (drift toward steady)
```

The engaged-neutral drift is what makes "thriving requires tension" literal:
maintenance days read healthy-steady, but H above the steady band decays
without fresh restraint or practice.

- Calibration period (first 7 evidence days): `H` locked at 0.68.
- Multi-day gaps: apply the drift law per missed day, capped at 7 catch-up
  days (mirrors `MAX_CAP_CATCHUP_DAYS`).
- Existing `ZEN_BONSAI_CULTIVATION_DAILY_CAPS` are retired as drivers and
  retained only as safety clamps on the derived vigor channels.

### 2.1 Invariants (tune only while preserving these)

| Invariant | Value with above constants |
| --- | --- |
| Full recovery, worst case (H at floor 0.12, four days of d=+1) | day 4 → H 0.900 ≥ thriving enter 0.88 ✓ |
| Full recovery from withered 0.33 | 0.61 → 0.77 → 0.87 → 0.92 (day 4) ✓ |
| Recovery from strained (mild damage) | ≤ 3 days |
| Adherence-only good days (d=0.7, no rituals) | full recovery in 5–6 days |
| One catastrophic day (d=−1) from thriving 0.92 | → 0.615 (strained) — visible, not fatal |
| Two consecutive catastrophic days | → 0.386 (withered) |
| One mild slip (d=−0.3) from thriving 0.92 | → 0.83 — tier held (hysteresis), H dented |
| Maintenance days (usage ≈ B, no rituals → d=0) | H settles toward steady 0.68 at half drift rate — no free thriving |
| Absence (neutral drift) from thriving | exits thriving after ~9 days, settles at steady |

The "4 consecutive days" promise refers to exemplary days (within limit **and**
~2 rituals). Adherence alone recovers in 5–6 days — rituals are the
accelerant, which is the intended incentive.

The `(1−H)` recovery form makes recovery time nearly depth-independent
(deep damage recovers big in absolute terms on day 1 — hope is immediate);
the `(0.30+H)` damage form makes damage self-limiting near the floor
(the tree never dies).

## 3. Tiers and hysteresis

`tier(H)` with enter/exit pairs (persisted; evaluate at day close only):

```text
thriving   enter H ≥ 0.88   exit H < 0.80
steady     between
strained   enter H < 0.62   exit H ≥ 0.68
withered   enter H < 0.42   exit H ≥ 0.48
```

**Recovery overlay** (independent of tier): active when cumulative ΔH over the
last 2 days ≥ +0.10 and tier is below steady. Guarantees day-1 visibility of
recovery.

`HabitSignal.tone` maps 1:1 from tier (+ `calibrating`; `recovering` = overlay
flag). Vigor channels (vitality/stress/bloom/dryness/branchSag/windResponse)
become **tier presets** with within-tier interpolation for bloom density and
moss saturation only.

## 4. Release age `R` and cultivation memory `G`

Structural size/age has one owner: progression's canonical `bonsaiRelease`.
Let `q` be the durable count of distinct 04:00 activity days on which the
tracking owner successfully recorded at least one managed protected visit.

```text
q = clamp(qualifiedUseDayCount, 0, 5)
R = q / 5
releaseScore = round(88 · R)
visibleGrowth = 0.50 + 0.50 · smoothstep(R)
```

The days need not be consecutive and never reset. Passive calendar time,
Dashboard opens, duplicate visits, and unprotected traffic do not change `q`.
Day 5 reaches the first complete structural form. No habit score, confidence
threshold, site-count threshold, cultivation daily cap, or persisted vitality
value may delay, reduce, or accelerate that release structure.

The persisted field historically named vitality growth `G` remains a 0–100
cultivation-memory integrator. It may drive recovery/milestone accents,
structural-imprint provenance, and bounded vigor interpretation, but it is no
longer the structural clock or an unlock gate. Its existing update law remains:

```text
s(H) = smoothstep(clamp01((H − 0.50) / 0.35))     // 0 below 0.50, 1 at 0.85
engaged day, d > 0:  ΔG = +12.6 · s(H) · (0.5 + 0.5·p)
otherwise:           ΔG = 0
dieback: after 10 consecutive days with H < 0.45,
         ΔG = −0.6/day while the condition holds, capped at −10 per episode;
         episode resets when H ≥ 0.65
```

- Healthy, practiced days may advance `G`; poor or absent evidence pauses it,
  and the bounded dieback rule may reduce only cultivation memory/appearance.
  It cannot shrink release-authorized wood.
- **Cultivation milestones every 12 points** may fire a recovery/new-shoot
  accent and stamp observation provenance. They do not add or remove candidate
  branches, change `R`, or gate the day-5 endpoint.
- Low-confidence or sparse habit evidence resolves to a neutral appearance.
  It never returns the tree to a smaller structural stage.

`ZenBonsaiLifeState.js` owns the pure renderer-facing life-state normalization
contract. `ZenBonsaiLifecycle` composes progression and cultivation inputs into
that contract, while `ZenBonsaiGrowthProjection` imports the narrow contract
directly. The render worker must not pull the lifecycle, cultivation, storage,
or progression owner graph merely to normalize an already-materialized life
state.

### 4.1 Structural habit imprint

`R` controls size/age. A separate structural imprint records, with bounded
influence, the conditions under which that released growth was experienced.
This prevents the model from saying "you are bad" while still letting the tree
remember patterns without turning them into permanent entitlement gates.

Persisted state in cultivation ledger V1:

```ts
type ZenBonsaiStructuralImprint = {
  schemaVersion: 1,
  exposureQuality: number,       // 0..1, meaningful contact with protected domains
  stressWood: number,            // 0..1, repeated overuse / ignored friction memory
  recoveryWood: number,          // 0..1, repeated return-after-slip memory
  volatility: number,            // 0..1, unstable alternating extremes
  canopyReserve: number,         // 0..1, long-run capacity for fullness/bloom
  lastUpdatedDateKey: string,     // last closed day applied to imprint
  lastEngagedOutcome: DailyOutcome | null,
  pendingDateKey: string,         // today's open day, not yet structurally applied
  pendingOutcome: DailyOutcome | null,
  updatedAtMs: number,
}
```

Milestone segment stamps in cultivation ledger V1:

```ts
type ZenBonsaiGrowthSegment = {
  schemaVersion: 1,
  id: string,                    // `m${milestone}`
  milestone: number,             // vitality milestone index, 1..8
  growthScore: number,           // milestone * 12
  dateKey: string,
  exposureQuality: number,
  stressWood: number,
  recoveryWood: number,
  volatility: number,
  canopyReserve: number,
  healthH: number,
  vitalityTier: string,
  createdAtMs: number,
}
```

Daily update inputs must come from `dailyOutcome`, practice evidence, and
trusted exposure facts only. The renderer must never query raw stats or goals
to invent form changes.

The integrator is close-on-advance, mirroring vitality: today's outcome is
stored as pending, then applied exactly once when `dateKey` advances. Repeated
same-day refreshes may replace the pending outcome but must not accumulate
stress, recovery, or canopy deltas.

Recommended state law sketch:

```text
meaningfulExposure = engaged day with managed active minutes or protected visit
strainPulse        = meaningfulExposure ? max(0, -d) : 0
practicePulse      = meaningfulExposure ? max(0, d) * (0.5 + 0.5·p) : 0
recoveryPulse      = previous engaged d < 0 and today d > 0 ? practicePulse : 0

exposureQuality ← ewma(exposureQuality, meaningfulExposure ? 1 : 0, half-life 14d)
stressWood      ← ewma(stressWood, strainPulse, half-life 21d)
recoveryWood    ← ewma(recoveryWood, recoveryPulse, half-life 21d)
volatility      ← ewma(volatility, abs(d - previousEngagedD) / 2, half-life 14d)
canopyReserve   ← clamp01(canopyReserve + 0.035·practicePulse
                                      - 0.025·strainPulse
                                      + 0.006·recoveryPulse)
```

Calibration rule: no structural penalty is applied during the first 7 evidence
days. The tree may open, root, and show neutral seedling motion, but kink,
compression, and gravity bias remain at baseline until cultivation begins. The
first eligible structural close is the first closed day after that horizon;
same-day pending values inside the horizon are not carried forward as hidden
penalty.

### 4.2 Structural projection parameters

Each milestone consumes the current imprint and stamps it into that milestone's
new trunk/scaffold/canopy segment. Existing older segments may visually relax
through health recovery, but their stamped structure is not silently rewritten.
Recovery is shown by healthier new shoots and reduced live sag, not by erasing
history overnight.

Target projection fields:

| Field | Source | Visual meaning | Bounds |
| --- | --- | --- | --- |
| `kinkPressure` | `stressWood + volatility - recoveryWood` | More angular deviation on newly stamped trunk/scaffold segments. | Low enough that the silhouette remains intentionally bonsai, never broken geometry. |
| `scaffoldCompression` | `stressWood - canopyReserve` | Shorter or narrower new scaffold tiers; lower final fullness for that growth episode. | A stressed episode can reduce that tier decisively, but cannot collapse the whole tree. |
| `gravityBias` | `stressWood + current branchSag - recoveryWood` | More downward bend and terminal droop on new or live stressed branches. | Recovery can reduce live sag; old stamped bends remain subtle memory. |
| `canopyBudget` | `canopyReserve + recoveryWood` | Leaf density, bloom capacity, moss fullness, and perceived generosity. | Good practice increases fullness more than raw height. |
| `recoveryShootBias` | `recoveryWood` | Pale new shoots, healthier terminal growth, dew/glint grammar after repair. | Recovery is visible from day 1 but does not grant instant full maturity. |

Implemented bridge contract:

- `ZenBonsaiGrowthProjection` now emits the projection fields above from
  normalized life-state vigor and `growthEvent`.
- `kinkPressure`, `scaffoldCompression`, and `gravityBias` are locked at
  baseline through the first 7 evidence days. The first week can establish and
  open the seedling, but it cannot stamp a penalty.
- `canopyBudget` and `recoveryShootBias` are projection-level visual capacity
  fields. They can change leaf/flower fullness and recovery shoot generosity,
  but they do not rewrite raw stats or goals.
- `projectZenBonsaiGrowthNode` consumes the fields as a bridge: scaffold/twig
  compression, subtle curve pressure, gravity-biased live sag, and terminal
  fullness.
- Cultivation ledger V1 stamps `growthSegments` when vitality `G` reaches a new
  12-point milestone. Each segment stores the structural imprint snapshot,
  health, tier, date, and milestone score. Projection maps branch role/depth to
  the nearest stamped segment so older trunk/scaffold/twig bands can retain the
  conditions under which they appeared.

Cultivation memory supplies feedback alongside the five-day structural release:

- A user with no protected domains gets no structural growth and no shame.
- A user who registers an unused domain gets no free fullness.
- Friction evidence can affect bounded cultivation feedback; it cannot speed up
  or delay qualified-use release.
- A user who slips retains released structure; recent vitality can recover on
  the same tree without resetting its structural age.

### 4.3 Growth horizon and phases

Target product horizon:

| Phase | Approximate evidence horizon | Purpose |
| --- | --- | --- |
| Establishment | 0-1 qualified-use days | Rooting and the established 50% initial form. |
| Juvenile training | 2-3 qualified-use days | Structural release advances independently of activation. |
| Form building | 4 qualified-use days | The first full form approaches its canonical endpoint. |
| First full form | 5 qualified-use days | Structural release is complete; recent activation still controls current vigor. |
| Refinement | Separate post-release evidence | Bounded cultivation memory and implemented appearance feedback; no 30-day developmental cycle is implemented. |

The pond/lower graph evidence window and the five-day bonsai structural release
keep separate clocks. Structure reacts only to canonical qualified-use days;
health and individuality react to their own evidence owners. Natural weather
follows the canonical local date/time independently of both habit axes.

### 4.4 Bridge projection: miniature growth

For the `classic` comparison-only path, the classic generator remains the
mature candidate generator and the bridge projection interprets early phases
as **miniature growth**, not as a hard visibility cut through a finished tree.
Production `classic2` has the stronger contract defined in §4.7: the generated
graph is the complete mature structural target, persisted lineage records its
development history, and the versioned presentation schedule owns actual
emergence and wood age.

Implemented bridge contract:

- Seedling/juvenile phases may reveal scaffold, twig, terminal, and small bloom
  signals before full maturity.
- Young phases reduce width, terminal distance, and terminal scale more
  strongly than they reduce total branch existence.
- Early depth limits are still allowed, but they must preserve enough
  ramification for a small cultivated tree to read as alive.
- Mature/display projections preserve the existing final-form contract.
- This bridge must not increase `R`, fabricate a qualified-use day, or expose
  the complete endpoint before canonical day 5. Day 5 itself is structural
  completion by contract.

The desired visual reading is: small, low, thin, and less deep — but already a
little world.

### 4.5 Growth event grammar

Milestones are not another meter. They should read as a small new growth point
on the current frontier.

Implemented bridge contract:

- `ZenBonsaiVitalityModel` records `lastMilestone` and
  `milestoneEventDateKey` when `G` crosses a 12-point step.
- `ZenBonsaiCultivationPolicy` exposes the vitality milestone/date fields as
  presentation facts.
- `ZenBonsaiLifecycle` preserves those facts as `growthEvent`.
- `ZenBonsaiGrowthProjection` turns `growthEvent` into deterministic
  `growthEventKind` / `growthEventStrength` / `growthEventSeed` fields.
- `sakuraRenderBranchLayer` uses those fields only to enrich existing growth
  tips; it does not read stats, goals, or the ledger directly.

`milestone_shoot` may add a few small leaves to eligible frontier tips.
`recovery_shoot` is weaker and exists to make recovery visible without
pretending the tree instantly matured.

This is intentionally a presentation bridge. The V1 stamped-segment ledger records the
conditions for reached milestones, but it still maps those stamps onto classic
branch roles at projection time. A later generator-time birth-band model may
replace the tip accent with actual segment birth events, while keeping the same
one-way signal path.

### 4.6 Surface condition grammar

Surface cues are not structural growth. They are short-lived, low-authority
presentation facts derived from closed-day vitality presentation.

Implemented bridge contract:

- `ZenBonsaiVitalityModel` resolves `microFeedback` as `dew_glint`,
  `leaf_fall`, or `null` from the last closed engaged day.
- `ZenBonsaiCultivationPolicy` exposes `vitalityMicroFeedback` and the last
  closed date.
- `ZenBonsaiLifecycle` preserves the micro-feedback inside `growthEvent`.
- `ZenBonsaiGrowthProjection` turns that into deterministic
  `surfaceFeedbackKind` / `surfaceFeedbackStrength` / `surfaceFeedbackSeed`
  fields and derives discrete `mossState` / `mossSaturation` from vigor.
- `sakuraRenderBranchLayer` draws only projection-level day-close cues:
  `dew_glint` becomes a small glint near an eligible frontier; `leaf_fall`
  becomes a single dry falling-leaf cue.
- `sakuraRenderer` uses projection moss fields for saturated/normal/pale/dry
  nebari moss tones. It does not read stats, goals, or the vitality ledger.

This deliberately stops short of a consume-once ceremony flag. Without that
state, the renderer can make a deterministic day-close cue visible while the
same `lastClosedDateKey` remains current. A future ceremony controller may
consume the cue after first display, but it must do so outside the renderer and
without making renderer state a business-data authority.

### 4.7 Classic2 production factor audit

This table audits the production `classic2` path, not the `classic`
comparison model. In Main, a persisted development record always wins over the
comparison-only depth/hash birth window. The final generated topology is the
complete mature structural target; lineage records every parent-causal branch,
and the emerged subset is the current rendered wood. The two timestamps
intentionally differ: persisted `birthProgress` means **development history
recorded**, while the versioned presentation `birth` means **shoot emergence**.

For current Main, `maxObservedGrowth` is a monotonic renderer/history checkpoint
of structural life growth that `bonsaiRelease` already authorized. It is not an
entitlement source and may not advance from vitality `G`, phase floors,
activation, debug sliders, or wall-clock time. The release projection may jump
to a newly earned day immediately; the daily appearance cap still applies to
vigor channels but cannot delay that structural checkpoint.

| Owner / factor | Biological or visual meaning and current default | Trunk / scaffold / twig and hash effect | Winning input and history / envelope coupling | Sensitivity and principal risk |
| --- | --- | --- | --- | --- |
| `resolveZenBonsaiClassic2GenerationStage()` | Candidate-generation stage; default `structureDepth=6`, clamped to `1..9`, label `Classic 2`. | No role curve or local jitter; it sets the common depth budget consumed by all three generation passes. | Seed, phenotype/latent-derived generation inputs, learning progress, and canopy tuning determine the candidate envelope upstream. The biological macro graph is fingerprinted separately from render tessellation. | Very high biological-topology sensitivity. A same-identity macro guide/station/lateral graph change is generator drift and fails; an identity input change is an explicit lineage rotation. Repartitioning the same guide into different adaptive spans is render-only and does neither. |
| `resolveZenBonsaiClassic2DisplayCandidateStage()` | Builds the stable display-capable candidate topology; defaults are depth `6`, learning progress `0`, `previewMode=false`. | Role density still comes from canonical trunk/scaffold/twig generation owners, not this adapter. | The topology is generated independently of current life growth. Canonical latent/version and generation inputs are in the tree identity; the resulting graph has a separate fingerprint. | High. It defines the complete growth-100 target but cannot itself decide current emergence. Treating it as the current visible tree would recreate the final-blueprint failure. |
| persisted development-lineage schedule | Exact-once biological development recording, not visible shoot emergence. The release-V1 latent record domain remains `[0.28,1]`, while the observable lifecycle starts at `0.5`; the single macro trunk root record is `0`. Therefore the first half-form includes the parent-causal lateral records already due by `0.5`. Readiness gaps are scaffold `0.0648` and twig `0.072`; persisted timing spans remain trunk `0.1296`, scaffold `0.1584`, twig `0.1296`. Deep records are bounded at `.94`, ensuring every logical candidate is recordable before the complete endpoint. | Adaptive trunk spans never become persisted candidates. The trunk descriptor is exactly one `[0,1]` macro root identified by `trunkGuideShapeId`, continuous arc length, and base width. A trunk-attached scaffold uses its stable station ID as logical node ID and global trunk arc as logical `attachT`; root position, tangent, taper width, and turn sign are sampled from that macro global arc. The containing physical span supplies only render parent/local `t`. Descendants remain role-depth based. | Stored `maxObservedGrowth` advances which logical candidates can be recorded. Stamped segments and structural imprint affect observation provenance, not membership or the clock scalar. Macro graph and logical carrier fingerprints bind records; the non-persisted physical render binding is deliberately excluded. Persisted `matureProgress` remains a timing-policy checksum field; the presentation schedule below owns rendered extension/girth completion. | Highest persistence sensitivity. The normalizer requires one exact macro trunk, parent closure, station-rooted lateral descriptors, and carrier coverage. Missing macro metadata or global station attachment fails loudly. A biological graph-contract cutover requires canonical local reset; a physical subdivision change does not. |
| `classic2_candidate_score_v1` / `classic2_apical_resource_features_v1` | Retained scaffold/twig development observation of graph-local structural support and terminal-carrier potential. It no longer ranks candidates for admission. | Same-role distal/aligned children receive the apical term; only trunk-attached scaffold candidates receive the small axial term; only scaffolds use side-mass balance. All non-trunk roles observe parent width/length support, fixed attach/angle occupancy bins, resource demand, and bounded carrier metadata. No vNext class, mutable field, wall clock, or random draw enters this seam. | Inputs are only the persisted candidate descriptor, fingerprinted carrier metadata, already-recorded decisions, the mapped stamped segment or structural imprint, and keyed policy seed. Records remain exact-once during normal reconcile; later activation cannot rescore anything. The result is provenance only and cannot select, retire, block, or delete a branch. | Low topology sensitivity by contract. Observation values may support later diagnostics or bounded morphology interpretation, but branch coverage and growth-100 completion must remain identical across histories. |
| `resolveZenBonsaiClassic2LineagePresentationSchedule()` / `classic2_wood_presentation_v1` | Converts logical development records into visible shoot emergence plus separate extension/girth milestones. Parent maturation fractions are trunk `.16`, scaffold `.08`, twig `.36`. Every physical trunk span maps to the one macro-root decision; one continuous global-arc frontier and additive extension integral determine how much of each render interval is visible. | Physical trunk position is the midpoint of the render binding's exact arc, never persisted node count or `roleDepth`. Root-attached scaffold readiness also samples its global station arc. Scaffold position remains `.55*roleNorm + .30*logicalTraversalNorm + .15*globalAttachT`; twig is `.45*roleNorm + .40*logicalTraversalNorm + .15*localAttachT`. A span calls the shared profile with its `[arcStart,arcEnd]`; it cannot create a local birth/frontier interval. | Normalized logical lineage owns decisions. Before projection, the non-persisted binding is checked against the current topology's exact node coverage/count, root, trunk guide/arc/geometry attestation, and logical mappings. Request signature, storage, and CAS exclude the binding, so equivalent tessellations reuse lineage history while any cross-topology reuse fails loudly. | Highest pacing sensitivity. Tests guard continuous visible arc, subdivision-invariant additive trunk length, arc-weighted girth, logical decision equality, exact topology/guide attestation, and different valid physical span counts. Diagnostics separate logical candidate count, physical node count, physical trunk span count, global frontier/integrated extension, persisted root record time, and derived span presentation. |
| `resolveBirthWindow()` | Legacy/non-lineaged Classic2 comparison curve only. Trunk birth is `0.03 + .58*roleNorm + jitter*.025`; scaffold starts at `.16 + .30*roleNorm - .045*scaffoldDevelopment - .045*ramificationFloor + jitter*.06`; twig starts at `.32 + .44*roleNorm - .07*ramificationFloor - .03*terminalDevelopment + jitter*.08`. | Role-specific clamps are trunk `0..0.74`, scaffold `0.08..0.72`, twig `0.18..0.84`; mature spans increase with depth. | In production Main it loses to the persisted development record. It remains only for the explicit no-lineage comparison path. | High popping and false-history risk if it ever re-enters Main. The architecture guard and `requireLineage` admission prevent that downgrade. |
| `resolveNodeAge()` | Continuous curve `smoothstep((woodClock-birth)/(mature-birth))`, evaluated independently for extension and raw local girth. | Every role uses the same resolver, but birth, extension mature, and girth mature milestones are role/depth specific. For trunk nodes this scheduled result remains inspectable as `naturalGirthAge`; the visible-width-normalized result becomes `girthAge`. Hash has no direct effect after the schedule exists. | Current Home uses persisted `maxObservedGrowth`; First Vision and Experiment use `min(currentLifeGrowth,maxObservedGrowth)` under the ephemeral policy. Projection phase floors and activation cannot advance either clock. | High visual sensitivity around emergence and both completion knees. Separating natural local girth from presented mass keeps the derivation traceable; the named ephemeral clock allows isolated presentation and reversible lab observation without rewriting history. |
| `resolveNodeScale()` + `ZEN_BONSAI_CLASSIC2_TRUNK_MASS_PRESENTATION_KNOTS` | Lineaged twig length/girth uses `smoothstep(age^1.15)` / `smoothstep(girthAge^1.1)` with floors `.018/.03`. Scaffold uses the same curves with emergence floors `.14/.065`. Trunk length floor is `.08`; its extension depth exponent is `.86→1.05→13` (tail `3`) and raw girth exponent is `1.5→1.55→12` (tail `1.8`). Visible trunk mass is a shared piecewise-smooth progress curve: `(0,.50)`, `(.32,.50)`, `(.40,.50)`, `(.57,.54)`, `(.70,.775)`, `(.85,.895)`, `(.94,.97)`, `(1,1)`. | Each trunk node combines local girth and a shoot-establishment continuity floor, then caps that result by the shared mass curve: `min(sharedMass,max(localGirth,continuity))`. The entry-life trunk floor is `.50`; it eases back to the normal `.12` late-shoot floor across growth `.50→.70`, so the initial tree reads as established without making later new branches appear mature. Presented `girthAge` reverse-maps from that active width floor to `1`; `naturalGirthAge` and `trunkMassScale` stay diagnostic. | The explicit shared mass curve wins visible trunk width; local scheduled age and parent-child width ceilings may only constrain it further. Final latent/candidate geometry remains the endpoint. Projection phase floors and activation do not rescale structural wood here. | Very high for snake silhouette, Hershey-kiss catch-up, joint pinching, popping, and stalled mid-growth. Knots, emergence floors, depth exponents, and width ceilings must be tuned together against aggregate and root-local checkpoints. |
| parent-child width ceiling | Enforces load/taper continuity after projection. | Child ratios: trunk from trunk `.98` (otherwise `.86`); scaffold from trunk `.74` (otherwise `.70`); twig from twig `.82` (otherwise `.58`). | The lower of projected child width and parent-width ceiling wins. It couples to final candidate width only as an upper target and records clamp diagnostics. | High at junctions. Too high creates swollen children; too low creates pinched attachments. `unclampedWidth`, `parentWidth`, and `widthCeiling` stay inspectable. |
| terminal carrier birth / age | A stable terminal site is born shortly after its emerged carrier begins extension. In lineaged mode, leaf-like terminals use `branchExtensionSpan*.04 + jitter*.004`; flowers use `*.08 + jitter*.006`. Leaf/flower maturation targets are capped at `birth+.11` / `birth+.14` and never later than branch extension maturity, with a minimum `.06` span. Presence also requires `woodClock >= birth` and age `>.015`. | Carrier role/depth supplies the branch span; keyed terminal hash only orders stable sites within that span. Flowers trail leaves, but terminal maturation no longer waits for full branch extension, allowing bud development while a twig is still extending. | Presentation branch emergence/extension and the surface-selected wood clock win. Bloom and activation never move carrier birth. Final terminal geometry is the target; initial lineaged scale is `.08` for leaf-like terminals and `.06` for flowers, with distance starting at `.18` plus physical floors. | High carrier starvation, premature bloom, and endpoint-pop sensitivity. Moving birth later collapses the mid-growth carrier curve; coupling terminal maturity back to full branch maturity recreates the late blossom dump. |
| bud / half-open / full progression | Source blossom stage supplies a small developmental lead, not a permanent ceiling. Flower age `<.50` is `bud`, `.50..<.96` is `half_open`, and a fully mature terminal reaches `full`. Openness multipliers are `.46/.78/1`. | Same progression on every carrier; carrier birth produces the temporal difference. No new random draw. | Terminal age wins structural stage progression. At growth `100`, every born structural flower is full-capable before activation chooses the presented cohort. Current bloom controls appearance later in the renderer, not lineage or birth. | Medium-high. Earlier full thresholds cause premature bloom; a source-stage ceiling makes growth 100 look permanently unfinished. |
| `resolveGrowthProgress()` / explicit wood-clock policy | `resolveGrowthProgress()` remains `max(normalized projection.progress, lifeState.growth)` only for the explicit non-lineaged comparison path. Lineaged Classic2 derives one named policy from lineage mode: `durable_main -> persisted_history = maxObservedGrowth`; `ephemeral_preview -> ephemeral_scrub = min(currentLifeGrowth,maxObservedGrowth)`. Projection progress remains diagnostic. | One structural-time scalar feeds every role schedule; role differences come from presentation milestones, not different clocks or hashes. | Durable Main history remains monotonic and authoritative. First Vision uses only its immutable ephemeral lifecycle/lineage; Experiment may rewind only displayed ephemeral wood. Neither can touch the durable key. `projectionLeadOverWoodClock` records unapplied phase-floor lead. | Highest history risk if bypassed. Taking `max(projection,maxObservedGrowth)` lets a phase adapter outrun cultivation; allowing a surface to choose a clock independently from lineage mode can mix presentation and durable history. |
| `resolveBloomSignal()` | Appearance signal is `max(life bloom, bloomDevelopmentFloor * smoothstep((vitality-.82)/.16))`. | No role difference; only born flower terminals can consume it. | Current vitality/bloom wins only presentation. It does not alter persisted development records, branch age, or terminal birth. | High premature-bloom risk but low topology risk. The separation is intentional: active health may open an existing bud, never invent a carrier. |
| activation presentation + blossom cohort | `ZenBonsaiExperienceModel` creates `{ratio,band,reliability}` only for a scored habit signal plus cultivation state. Expressed signal is `.5 + (ratio-.5)*(.58+.42*reliability)`; band is low at `<=.42`, high at `>=.82`, steady otherwise. Mature cohort is `clamp(.16+.86*signal^1.2,.16,.96)`. Before growth `.99`, it is multiplied by the bounded late-growth handoff so a carrier-rich growth-70 tree cannot open its near-final cohort. Structural buds may become half-open; structurally half-open blossoms may finish under high activation; a structural full flower may present as bud, half-open, or full. | The keyed `activation_bloom_cohort` hash gives each existing flower a stable order. `resolveSakuraFrontierBloomCue()` exists only in the juvenile handoff and always returns `half_open`. Activation also changes tip-leaf count, terminal scale/saturation/brightness, tilt/droop, bud swelling, and openness; none of these create branch or terminal identity. | Ephemeral ratio/reliability plus persisted life growth win only current presentation. The frontier cue is excluded from structural carrier counts and disappears at the structural hand-off. Neither path mutates terminal age/birth, lineage, cultivation, or candidate identity. | High visual sensitivity, zero authorized topology sensitivity. Growth 100 plus high activation must read as predominantly full bloom while low activation may remain restrained. Unkeyed cohorts flicker; allowing presentation into carrier birth creates a parallel truth source. |
| activation runtime / bake cohort signatures | Scene snapshot runtime signature quantizes ratio at `.01` and reliability at `.05`. The bounded bake signature combines the `activation:bake` prefix, band, and expressed signal quantized at `.1`; it participates in both `branchRigSignature` and the dispatch-level `sceneSignature`, while the finer runtime signature also participates in `sceneSignature`. Pixi passes `resolveZenBonsaiActivationBakePresentation()` rather than the raw presentation into branch-rig baking, so every input sharing a cache key also shares the exact baked ratio. | Common across roles. The `.1` signal cohort rebakes branch/terminal presentation often enough to preserve within-band change without rebaking on every raw-score fluctuation. Raw activation still drives runtime tint/droop, while sprite count, scale, filter, and blossom stage use the canonical bake cohort. Pixi sets `deferBranchSagToRuntime=true` during texture baking, then applies life, imprint, and activation sag once in the live branch transform. | `zenBonsaiSceneSnapshot` owns dispatch/rebake admission and the activation presentation model owns cohort normalization. Activation cannot directly invalidate topology, back/front static layers, or persistence. | Medium performance and high responsiveness sensitivity. If dispatch observes runtime signature but not bake signature it can drop a required rebuild; raw bake inputs make identical keys history-dependent; applying sag in both bake and runtime causes backend divergence and cohort-bound popping. |
| shared Sakura nebari owner | `sakuraRenderer.js` owns one tapered four-root/toe system plus a small soil-contact shadow; there is no broad root-bed ellipse or opaque trunk-flare overlay. Root base width derives from the actual projected trunk width. For lineaged Classic2, reach and mass both follow projected root `girthAge`. | Root geometry is keyed only by immutable tree identity/angle, phenotype/morphology, and pot style. A separate surface seed adds moss state and quantized saturation for soil/moss variation without moving roots. Pot soil, moss, root toes, and soil join render in BACK before the tree; FRONT owns only glazed pot occlusion. The ground-branch shadow is optional and does not gate pot/nebari. | The materialized Classic2 root width/girth age wins over raw growth projection. Canvas and Pixi share this Sakura owner and layer contract rather than drawing corrective overlays. Moss may change appearance through the surface seed but cannot change root geometry. | High basal-continuity sensitivity. A second clock or opaque front flare creates width mismatch and the flat pasted-on mass; coupling geometry seed to vitality makes roots jump; drawing toes in FRONT makes them cover the trunk unnaturally. |
| `projectZenBonsaiClassic2DevelopmentTopology()` | Canonical materializer: normalizes logical lineage, attests its branded render binding against the current topology, derives per-span trunk presentation, hides future lateral candidates, projects extension/girth/terminals, applies width continuity, and emits split logical/physical diagnostics. `requireLineage=true` is mandatory in production. | Traverses the physical render hierarchy but resolves every node through `physical node ID -> logical node ID`. All trunk spans map to the macro root; scaffold roots map to station IDs; lateral descendants retain their biological IDs. At growth `1`, every physical render node belonging to the complete logical graph is present. | Persisted logical history owns eligibility; the render binding owns only current topology mapping; the surface-selected wood clock owns time. Binding identity and its physical geometry fingerprint never enter persistence or the lineage request signature. | Central failure seam. Missing/unbranded binding, node coverage/count mismatch, wrong root/role/guide, trunk geometry/arc mismatch, or wrong logical mapping fails loudly. It never falls back to physical node lookup, another model, or depth/hash reveal. |
| `resolveZenBonsaiClassic2RenderProjection()` | Presentation adapter forces depth/reveal channels to their full carrier capacity, then lets development lineage own actual presence. Leaf floor interpolates `.54→.36`; flower gate `.28→.82`; bloom floor `.18→.72`; miniature bloom scale `.50→.90`. | Common presentation fields; role presence still comes exclusively from lineage timing. No hash. | Existing projection values may win through `max`, but cannot reveal a branch before its record and emergence time. Current life affects leaves/flowers and bounded morphology; lineage affects wood time. | Medium. Lineage gating prevents premature full-blueprint exposure during growth, while the all-candidate endpoint prevents a smaller self-normalized final canopy. |
| `resolveZenBonsaiClassic2RenderStage()` | Packages the generation-stage depth with the Classic2 render projection. | No independent role or jitter rule. | It is downstream of model selection and upstream of candidate generation/rendering; it cannot select lineage. | Low alone, high if misused as a topology owner. Canvas and Pixi must consume the same already-materialized topology. |

The practical invariant is: short-term activation owns only ephemeral terminal
expression and its bounded bake cohort; long-term cultivation owns the
monotonic wood clock, exact-once development records, and bounded continuous
morphology; the versioned wood schedule owns emergence/extension/girth; the
Experiment clock policy may only scrub the displayed subset of its isolated
in-memory lineage; seed, latent, and canonical generation inputs own the
complete mature topology. None of these channels may silently substitute for
another.

### 4.8 Classic2 versus vNext decision

The comparison baseline is production `classic2`. `vnext` is a separate
research engine, not a newer synonym for the Main runtime. The comparison below
therefore asks which principles can strengthen the canonical Classic2 seam; it
does not award ownership to vNext merely because its local algorithm is more
elaborate.

| Criterion | Classic2 production evidence | vNext evidence and integration gap | Decision consequence |
| --- | --- | --- | --- |
| Actual lineage / bud growth | Every parent-causal candidate receives one development record under one exact release contract; carrier fingerprints and monotonic Main wood history are persisted. A separate versioned schedule materializes shoot emergence, extension, and girth; Experiment only scrubs its isolated displayed clock. The final candidate graph is the complete growth-100 target. | V2 has explicit bud, backbone, scaffold, pad-intent, and lineage growth engines, so its local developmental vocabulary is richer. It rebuilds a new graph per run and persists preference/trial artifacts, not Main-compatible branch lineage or bud energy history. | Keep persistent development history and the single Classic2 presentation materializer; borrow only bounded morphology principles behind those owners. |
| Apical dominance / branch hierarchy | Trunk is the structural spine; every scaffold/twig waits for its recorded parent, while visible child emergence additionally waits for role-specific presentation maturation (`.16/.08/.36`). The retained observation scorer records bounded distal/alignment continuity, parent support, canonical-history resource mismatch, and terminal-carrier potential without controlling membership. | Default vNext V2 derives apical dominance from height/taper/apex softness/vigor, but the value actually affects distal radius ratio and continuation vigor rather than a global sibling resource allocation. `resourceBudget`/`sapFlow` are written without downstream decision reads. | Use those signals only for bounded angle, sag, compression, and canopy expression. Do not claim a complete physiological conservation model and do not copy dormant vNext state fields. |
| Occupancy / light / style field | Parent/cohort fill, fixed parent-local attach/angle bins, recorded sibling load, and side mass are retained as exact-once observations after O(N) precompute; they do not shape admission. | Literal `OccupancyFieldModel`, `LightFieldModel`, and `StyleFieldModel` need absolute position, heading, bounds, mutable spatial samples, or explicit style targets that the persisted Classic2 descriptor does not own. | Keep the graph-local observation seam. Literal field adoption requires a post-public architecture decision for a new candidate descriptor/fingerprint and proof that bounded projection fields are insufficient. |
| Persistent growth history | The typed profile aggregate stores the active identity together with candidate graph, carrier metadata fingerprint, monotonic `maxObservedGrowth`, and all-parent-causal records. Cultivation V1 stores structural imprint and stamped growth segments. Emergence/extension/girth are deterministic projections, not a second persisted history; ephemeral scrub is not persisted. | Workspace persistence covers research/runtime factor state and preference artifacts, but not a Main-compatible durable bud/topology history driven by cultivation milestones. | The aggregate repository remains the only current-tree identity/structural-history owner; the presentation schedule and lab scrub may derive but not persist a competing timeline. |
| Deterministic replay | Durable profile epoch, candidate and identity fingerprints, keyed hashes, exact-once records, strict normalization, and state/identity revisions define replay and drift failure. Numeric revisions are epoch-local; an old epoch cannot author a new aggregate. | V2 uses keyed/random-policy inputs and provenance buffers, but has no end-to-end replay contract across Main persistence, cultivation, and renderer admission. | Reuse keyed deterministic provenance as a principle; acceptance requires byte-equivalent Classic2 record replay and history-invariant branch membership. |
| Cultivation / vitality connection | Release `R` alone authors structural time. `G`, structural imprint, and stamped segments enter development-observation provenance and bounded morphology/vigor projection; short-term vitality cannot rewrite wood identity or release age. | V2 research inputs are not connected to the current cultivation ledger, lifecycle growth domain, or Main readiness gate. | Keep the current lifecycle contract; vNext fields may consume only normalized Classic2 inputs. |
| A/B latent / preference learning | The candidate envelope already consumes canonical Sakura latent/version inputs and the established preference-learning contract. Identity changes use the current explicit identity owner. | vNext has a separate factor schema, feedback store, preference model, trainer, and optimizer contract. | Do not run both preference contracts for Main. Any adopted factor must map into the existing canonical latent/identity boundary or require a separate post-public architecture decision. |
| Canvas / Pixi renderer compatibility | Both renderers consume the same already-materialized emerged Classic2 topology. Development time, wood clock, carrier birth, activation cohort, and bake admission are resolved before or at their named presentation owners. Shared Sakura also owns one root-girth-clocked nebari geometry and BACK/FRONT pot layering rather than backend-specific corrective overlays. | A topology adapter exists, but vNext is not proven against the full Canvas/Pixi presentation, terminal progression, width-continuity, activation bake, nebari, and first-visual contract. | Preserve the Classic2 materializer, activation contract, shared Sakura owner, and existing renderers. |
| Worker execution cost | Classic2 is already wired into the current Main host/worker lifecycle. Release V1 observation feature context is O(N), each candidate observation uses fixed maps/bins in O(1), and the candidate cap stays 2,400. The emerged topology, not a second field engine, continues to cross the render boundary. | Optimizer/trainer workers exist, but V2 generation used by the independent research runtime remains a main-thread engine path; V2 queue shifting and worst-case spatial buckets can become quadratic, while V3 claim competition is `bud × attractor`. | Keep bounded Classic2 observation in the current owner; no vNext Main promotion on local sophistication alone. |
| Storage contract | `zen_bonsai_profile_aggregate_v1` is the one typed current-tree slot for active identity plus nested `classic2_development_lineage_release_v1`. Its `profileEpoch` must equal the canonical reserved ModelState epoch row inside the same IndexedDB transaction. Durable Main requires the exact epoch/active identity/candidate and bounded CAS. Only extension-lifetime first-run may bootstrap missing state under the current epoch; an exact aggregate reconciles; a different complete identity advances both revisions once and clears lineage in the same CAS; every stale-epoch, historical, disappeared-after-hydration, or malformed shape fails loudly. Experiment drafts and First Vision are ephemeral. No runtime migration exists because there are no released users. | A future post-release replacement would need topology/bud state schemas, identity mapping, historical replay, preference migration, and cutover/rollback policy. | Keep one aggregate contract plus one storage-lifecycle-owned epoch row and clear model state with a new epoch atomically. Do not add speculative compatibility paths. |
| Failure policy | Corrupt or wrong-contract lineage, graph or carrier-fingerprint drift, identity collision/staleness, conflict exhaustion, and candidate-budget overflow fail loudly. There is no legacy/vNext fallback. | Research workspaces can expose local diagnostics, but they do not yet define Main admission and cross-context persistence failure behavior. | Classic2 fail-loud policy remains normative. |
| Tests / architecture guards | Model, runtime, repository, projection, storage-boundary, and architecture guards protect the canonical path. | vNext has focused engine/factor tests, but not equivalent lifecycle-to-persistence-to-renderer Main coverage or ownership guards. | Port principles together with Classic2 tests and guards, never as an unguarded side path. |
| Parallel truth-source risk | Main has one mature candidate topology, one persisted development ledger, and one materializer. | Enabling vNext topology, history, or preference state beside Classic2 would create competing answers for branch identity and growth history. | Simultaneous Main truth is prohibited. vNext stays a research/reference implementation. |

**Conclusion / 결론: 2. vNext의 특정 원리만 Classic2에 흡수.** The
principles are persistent development history, role hierarchy with bounded
apical/resource observations, continuous angle/gravity/compression response,
and keyed deterministic provenance.
The retained release V1 `classic2_candidate_score_v1` observes parent-local
clearance, apical continuity, parent support, sibling demand, history/demand
mismatch, and side mass with a keyed input fingerprint and explicit breakdown.
It does not select a subgraph. Literal vNext occupancy/light/style fields, bud
queues, energy, topology, and preference state were not imported.
The canonical owners remain
`ZenBonsaiClassic2LineageModel`, its typed repository/runtime, the existing
lifecycle, and the current Canvas/Pixi/worker presentation path. vNext V2 bud and
field code is a reference implementation, not a second Main source of truth.

The release V1 distribution audit generator executes 5 seeds × 5 deterministic
cultivation histories × 7 sequential checkpoints. Its regenerated current
manifest is the evidence owner for replay, monotonic recorded-set, exact-once
records, candidate/presentation subset, parent closure, history-invariant branch
membership, distribution, and record-size measurements. Active architecture
does not compare predecessor policy or record schemas.

The audit also makes the new invariant explicit: for each seed all five
histories retain one candidate fingerprint and exactly the same final branch
membership. History may affect bounded morphology and observation provenance,
but it cannot remove or invent a scaffold. The recorded release V1 depth-6
final states measure 575,269–971,666 bytes. The current 2026-07-21 depth-8
high-density remeasurement is recorded in §4.9; every seed remains below the
2,400 logical-candidate admission ceiling and the independent 2,448 physical
traversal ceiling.

In the core-question classification, popping, age pacing, and parent/child width
are parameter/projection problems and the current lineaged projection improves
them; branch-history non-persistence is resolved by the typed exact-once release
lineage. The release contract includes fingerprinted carrier metadata directly,
without a runtime migration or density-reopen seam and without making the
renderer a branch owner. Mature branch geometry is still precomputed in the
candidate topology, while cultivation imprint applies only bounded continuous
deformation. That evidence supports decision B, not C; reconsider a vNext
replacement only if measured cases require new scaffold geometry outside the
candidate rather than stronger bounded projection inside it.

### 4.9 Classic2 lineage performance budget

Candidate preparation is a module-branded value produced once for a
topology/identity pair. It contains the validated logical candidate graph, graph and
identity fingerprints, logical candidate count, physical node/span counts, a
module-branded render binding, and identity revision. The binding is ephemeral
and carries the generator's guide/span/physical-geometry attestation. It must
never be serialized or included in the lineage request signature. The runtime
shares that value across its fingerprint check and every bootstrap/reconcile CAS
attempt, while projection re-walks the exact current topology and verifies node
coverage/count, root, trunk continuity/geometry/guide, and logical mappings.
Callers cannot forge a prepared value by reconstructing its object shape or
reuse a branded binding against a different topology. `identityRevision`
remains excluded from the identity fingerprint, so a
preview-only revision promotion rebrands the same graph/fingerprints instead of
extracting the candidate again.

Admission has two non-interchangeable fail-fast budgets. The durable logical
candidate graph is capped at **2,400 nodes** by
`ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_NODE_BUDGET`; exceeding it throws
`ZEN_BONSAI_CLASSIC2_LINEAGE_CANDIDATE_BUDGET_EXCEEDED`. The render-only physical
walk, including every adaptive trunk span and the root, is capped separately at
**2,448 nodes** by `ZEN_BONSAI_CLASSIC2_PHYSICAL_TRAVERSAL_BUDGET`; physical node
2,449 throws `ZEN_BONSAI_CLASSIC2_LINEAGE_CANDIDATE_PHYSICAL_BUDGET_EXCEEDED`.
Neither path truncates, lowers quality, or falls back to another model. The
2026-07-21 five-seed depth-8 audit (`17, 83, 211, 478, 997`) measured
1,915–2,331 logical candidates backed by 1,949–2,349 physical nodes. The split
keeps durable-size admission at the release 2,400 bound while allowing the
bounded render tessellation overhead already inside the measured envelope.
Raising either budget requires a new state-size, CPU, renderer, and
worker-readiness audit in this Active spec.

Durable size is governed by the smaller logical graph: one macro trunk, stable
station-rooted scaffolds, and lateral descendants. `physicalNodeCount`,
`physicalTrunkSpanCount`, and `candidateCount` are distinct diagnostics.
Collapsing or repartitioning trunk spans is never permission to spend logical
budget on physical traversal or physical headroom on durable candidates.

Reconcile builds one scoring context per call: role max depth, complete cohort
membership, history segment assignment/aggregate, candidate/selected
parent/cohort fill, fixed attach/angle occupancy bins, parent cross-section/mass
load, and scaffold side mass. That precompute is O(N); repeated cohort scoring
reads and increments fixed maps/bins in O(1). Candidate scoring must not rescan
the full graph, descendants, or all decisions. This is both a performance and
replay rule: adding absolute fields, pairwise geometry, or dynamic bud state
requires a separately versioned contract.

Local single-process `vite-node` measurements on 2026-07-11 used the same
five-seed harness before and after the change. Generation time is reported
separately and is not credited to the lineage optimization.

The timing table below is the prepared-candidate optimization baseline captured
before the release V1 score provenance fields; it remains evidence for the preparation seam, not a
claim that the new record size is unchanged.

| Envelope | Candidate count | Cold fingerprint + bootstrap median | No-growth reconcile median | Pre-release-V1-score serialized lineage state |
| --- | ---: | ---: | ---: | ---: |
| Default depth 6/8 | 301–755 | `15.632ms` → `12.368ms` (-20.9%) | `2.915ms` → `0.038ms` (-98.7%) | 101,422–229,026 chars |
| High-density depth 8 | 1,904–2,056 | `64.244ms` → `37.634ms` (-41.4%) | `9.397ms` → `0.032ms` (-99.7%) | 555,173–597,441 chars |

The release V1 score contract stores raw bounded signals plus weighted contributions for traceability.
The pre-cutover physical-trunk graph measured 3,855,794–4,667,563 bytes. The
2026-07-21 post-cutover five-seed audit measures 3,845,977–4,680,547 bytes for
1,915–2,331 logical candidates backed by 1,949–2,349 physical nodes. Lateral
candidate decisions dominate this payload, so collapsing adaptive trunk spans
is an identity/replay-stability cutover, not a blanket serialized-size claim.
The active descriptor stores guide identity and full-arc geometry once on the
macro root and stores no render binding. Any new repeated candidate/decision
field or change to either the 2,400 logical or 2,448 physical budget requires a
fresh size envelope and deterministic distribution audit.

These timings are regression evidence, not a cross-machine SLA. The normative
limits are the separate 2,400 logical-candidate and 2,448 physical-traversal
fail-fast ceilings, one prepared logical candidate plus render binding per
runtime input pair, no binding in durable state/request signatures, and no full
graph/decision scan inside `scoreCandidate`.

### 4.10 Classic2 measurable growth-experience contract

`model/classic2/ZenBonsaiClassic2GrowthExperienceContract.js` is the retained
comparison-tuning reference for the Classic2 growth read. It does not
author lineage or renderer state. The growth matrix consumes the contract and
reports `PASS` or `OUTSIDE_TARGET` together with signed deviation, so a low-level
cap, phase floor, cache band, or reveal gate cannot silently make a higher-level
knob ineffective.
The release V1 checkpoint envelope covers release V1 lineage,
`classic2_wood_presentation_v1`, and the bounded half-open frontier cue. Matrix
version 1 evaluates every field below, including the local root segment and
nebari/trunk join, and reports signed deviation without converting this
diagnostic harness into a silent quality fallback.

`node scripts/dev/zen-bonsai-growth-snapshot-matrix.mjs --bundle-only` is the
cheap call-contract/build check: it refreshes the browser bundle without
launching Chromium or rewriting PNG/manifest captures. Macro-lineage and
tessellation invariants belong to the pure-model lineage distribution audit;
run the full matrix only when rendered growth, terminal, or pixel evidence is
actually under review.

Wood ratios use one sequential exact-once lineage advanced through every
checkpoint and that same tree's growth-100 selected topology as denominator.
They compare aggregate projected length/width rather than mean node size, because
new shoot birth would otherwise make a healthy trajectory look as if it shrank.
Root length/width ratios are the projected root segment normalized to that same
growth-100 root, not the whole trunk. A near-final root length therefore anchors
the pot connection while root width and aggregate trunk mass can remain young.
`rootBaseToTrunkRatio` is different: it is the current checkpoint's shared
Sakura nebari base width divided by the actual projected root/trunk width, so it
directly guards against a detached overlay or a flat oversized base rather than
normalizing against the final endpoint.
Born ratios compare emerged scaffold/twig/carrier counts with the same final
selected tree. Seed `478` supplies the count-level blossom reference; the
normalized wood/carrier ranges and bounded join ratio are the portable contract
for broader seed runs.

| Growth | Root length | Root width | Nebari base / trunk | Trunk length | Trunk width | Scaffold born | Twig born | Carrier born |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 12 | `.94-1` | `.20-.25` | `1.08-1.16` | `.04-.06` | `.025-.045` | `0` | `0` | `0-.04` |
| 24 | `.98-1` | `.27-.31` | `1.13-1.21` | `.15-.20` | `.085-.12` | `.04-.12` | `0-.04` | `0-.08` |
| 42 | `.99-1` | `.52-.56` | `1.17-1.24` | `.41-.47` | `.33-.39` | `.25-.40` | `.02-.12` | `0-.04` |
| 55 | `.99-1` | `.75-.80` | `1.20-1.27` | `.53-.59` | `.58-.65` | `.42-.62` | `.18-.32` | `.04-.14` |
| 70 | `.99-1` | `.87-.92` | `1.22-1.29` | `.68-.75` | `.80-.86` | `.72-1` | `.45-.62` | `.18-.34` |
| 82 | `.99-1` | `.95-.99` | `1.24-1.30` | `.82-.88` | `.94-.99` | `1` | `.72-.88` | `.52-.68` |
| 92 | `.99-1` | `.97-1` | `1.24-1.30` | `.99-1` | `.97-1` | `1` | `.90-.97` | `.90-.97` |
| 100 | `1` | `1` | `1.24-1.30` | `1` | `1` | `1` | `1` | `1` |

Blossom acceptance measures rendered count and separate bud, half-open, and full
ratios. At growth 42 the rendered count may include the bounded half-open
frontier handoff cue, but that cue is excluded from the independently evaluated
structural carrier ratio. A closed carrier remains visible as a bud and is not
deleted. Growth 100 makes every structural flower full-capable; activation may
still choose a restrained current presentation without changing carrier identity
or birth history. Pixel comparison covers the full `360x440` canvas; a pixel is
counted as changed when its mean absolute RGB delta is at least `12`.

| Growth | Activation 18 presentation | Activation 58 presentation | Activation 92 presentation | Minimum low/high pixel delta (`mean RGB` / changed ratio) |
| ---: | ---: | ---: | ---: | ---: |
| 70 | mostly bud | bud / half-open mix | emerging full cohort | `1.50 / .015` |
| 82 | bud-led | half-open-led | full-led | `2.00 / .025` |
| 92 | restrained bud/half-open | mixed | predominantly full | `3.00 / .050` |
| 100 | restrained bud/half-open | mixed with full | at least `.88` full ratio | `3.00 / .050` |

The control hierarchy is normative:

| Question | Canonical owner | May not do |
| --- | --- | --- |
| Which active tree and branches are durable, and when was each development record created? | `ZenBonsaiClassic2IdentityContract` fingerprint + `ZenBonsaiProfileAggregateModel` active identity + candidate topology + `ZenBonsaiClassic2LineageModel` + typed aggregate repository (`birthProgress = development_history_record`) | history score, current activation, renderer, localStorage, First Vision, or Experiment draft may not select, retire, block, delete, rewrite, migrate, or dual-write membership |
| What time is structural wood allowed to observe? | Classic2 lineage runtime mode: current Home `durable_main -> persisted_history = maxObservedGrowth`; First Vision/Experiment `ephemeral_preview -> ephemeral_scrub = min(currentLifeGrowth,maxObservedGrowth)` | phase floors may only be diagnosed; ephemeral time may not persist or enter current Home |
| When does a recorded shoot emerge and extend/thicken? | `resolveZenBonsaiClassic2LineagePresentationSchedule()` (`birth = shoot_emergence`, separate `extensionMature` / `girthMature`) | it may not mutate persisted v1-origin development/mature timing fields or persist a parallel history |
| When does a stable terminal carrier appear? | Classic2 development materializer terminal schedule | bloom/vitality/activation may not invent, delete, or move carrier birth |
| How open, saturated, upright, or swollen is it now? | `ZenBonsaiExperienceModel` → `ZenBonsaiActivationPresentation` → shared Sakura appearance/cohort | it may not enter lineage, wood time, storage, or candidate identity |
| When does the branch rig rebake? | `buildZenBonsaiActivationBakeSignature()` in `zenBonsaiSceneSnapshot` (`band + .1 signal cohort`) | a band-only key may not flatten within-band activation, and raw unquantized score may not force every-frame rebakes |

If a target is missed, move the lowest canonical owner that actually limits the
measurement. Do not compensate by making a higher layer lie: for example, do
not add fake structural branches in the renderer to hide a lineage pacing
failure, do not normalize growth 100 against a smaller materialized subgraph,
and do not let activation create terminal identity to hide a carrier birth
failure. Target changes require this table, the code contract, matrix report,
and focused tests to move together.

## 5. Presentation contract

Discrete, silhouette-level signatures per tier (continuous interpolation only
inside a tier):

| Tier | Signature |
| --- | --- |
| thriving | bloom density 0.8–1.0, saturated moss, morning dew glint pass, no sag |
| steady | bloom 0.35–0.6, normal moss, occasional petal drift |
| strained | moss pales/dries at pot rim (discrete moss state), **one** designated branch cluster droops, bloom ≤ 0.2, slight foliage desaturation |
| withered | two branch clusters droop, leaf yellowing + occasional leaf-fall, no bloom, dry soil tone |
| recovery overlay | pale-green shoot tip on the newest milestone branch + dew shimmer, shown in any tier |

Daily micro-feedback, after day close (diegetic, 1-bit, no meters — zen tone):

- good day (`d > 0`): a single dew glint pass (~2s)
- bad day (`d < 0`): one leaf detaches and falls
- neutral: nothing

## 6. Integration points

- `src/domains/settings/config/siteRules.js`: `globalGoal` and `siteGoals`
  remain user-authored settings. Normalization is shape/range hygiene only; it
  does not apply a dynamic baseline-derived maximum.
- `src/domains/protection/domain/protectionGlobalCap.js` and protection runtime
  inputs: runtime cap/reinforcement decisions read the normalized user goal.
  They do not substitute `creditRef` or `deductRef` for the user's visible
  commitment.
- `src/domains/stats/analysis/usageBaseline.js`: per-rule common robust
  daily-minutes profile (unweighted 28d, current day excluded, engaged days only).
- `src/domains/stats/analysis/scoreRuleReference.js` and `scoreLedger.js`: dual references per rule
  (`creditRef`/`deductRef`), flat within-limit credit (+3 global / +1 site)
  only when the day beats the credit reference, per-rule `adherence` on
  `summary.outcomeBasis`, and `finalizeScoreDailyOutcome(basis, practice)`
  producing `d`. Deduction caps, scoringMode, coverage logic unchanged; the
  0–100 display score keeps its meaning for stats UI.
- `src/domains/stats/background/query/statsStatusSnapshotReadModel.js`:
  computes `usageBaselines`, today practice counts, and
  `metrics.dailyOutcome`; flows through `useStatusController` →
  `HomeScanWorkspace.authoritativeBonsaiLifecycleInput.dailyOutcome`.
- `src/themes/plugins/zen/model/ZenBonsaiVitalityModel.js`: state laws
  (`advanceZenBonsaiVitalityDay`, `reconcileZenBonsaiVitality`), tier
  hysteresis, tier vigor presets, presentation resolver.
- `src/themes/plugins/zen/model/ZenBonsaiCultivationLedger.js` (release V1):
  persists the `vitality`, `structuralImprint`, and `growthSegments` sections.
  Vitality reconcile
  closes days on dateKey advance and gates the integrator on the CULTIVATING
  stage (health locked during calibration). Structural imprint also closes the
  pending day on dateKey advance, but starts only after the first 7 evidence
  days; it stores exposure, stress wood, recovery wood, volatility, canopy
  reserve, last engaged outcome, and today's pending outcome. Growth segments
  are stamped once for each reached vitality milestone and are not rewritten on
  later recovery. Previous ledger shapes are rejected; missing release V1 state
  bootstraps from the establishment-capped cultivation score on first
  cultivating reconcile.
- `src/themes/plugins/zen/bonsai/state/ZenBonsaiTargetModel.js`: threads the
  ledger vitality presentation (`bonsaiVitality`) and structural imprint
  (`bonsaiStructuralImprint`) plus stamped segments (`bonsaiGrowthSegments`)
  into the input and re-runs resolution when a day closed, so day-close visuals
  and structural memory land the same frame.
- `src/themes/plugins/zen/model/ZenBonsaiCultivationPolicy.js`: when strict
  `bonsaiRelease` is present, structural `growthScore`, phase, growth, data days,
  and full-form readiness come only from that DTO. Vitality `G`, habit signal,
  confidence, and imprint continue to supply vigor/tier/recovery/milestone
  presentation. Older explicit growth inputs remain isolated to named Lab or
  comparison surfaces and are not a Main entitlement path.
- `src/themes/plugins/zen/model/ZenBonsaiGrowthProjection.js`: current
  `ZEN_BONSAI_GROWTH_BASELINE_DAYS = 7` is the release V1 establishment projection constant.
  That comparison/evidence projection constant is not the public release length:
  five canonical qualified-use days own the exact first full-form target, never
  an elapsed-data shortcut. New projection work must
  read `bonsaiRelease` for structure and vitality/imprint only for bounded
  appearance. The
  current bridge implementation treats seedling/juvenile states as miniature
  growth: early scaffold/twig/terminal signals are present, but width and
  terminal scale are reduced. It also consumes lifecycle
  `growthEvent` to produce deterministic milestone/recovery tip accents and
  day-close surface feedback fields, and consumes lifecycle structural memory
  plus stamped growth segments to derive bridge fields
  (`kinkPressure`, `scaffoldCompression`, `gravityBias`, `canopyBudget`,
  `recoveryShootBias`) before classic branch projection. Those fields remain
  the aggregate geometry/deformation bridge; they are not the owner of branch
  identity or birth events.
- `src/themes/plugins/zen/model/classic2/ZenBonsaiClassic2LineageModel.js`:
  owns the comparison Classic2 candidate graph fingerprint, all-parent-causal
  development records, terminal-carrier potential, and exact-once provenance.
  The record accepts only `classic2_development_lineage_release_v1`. The
  prepared candidate stores logical per-node terminal and flower counts plus
  `candidateCarrierFingerprint`, and separately carries a branded render binding.
  The generator attests its guide shape, physical trunk span count, and rounded
  entry-angle/length/width/curve/arc geometry; the binding carries that
  fingerprint and projection verifies it against the exact current topology.
  It validates one contiguous emitted physical trunk arc but fingerprints one
  macro trunk descriptor (`trunkGuideShapeId`, continuous arc length, base width,
  exact `[0,1]`). Stable scaffold station IDs/global arcs replace physical trunk
  parent IDs/local span `t` in the logical graph. A missing macro or station
  attachment is generator drift, not a reconstructed fallback. There is no record migration,
  historical-policy read, or record-reopen path. Future candidates stay pending
  only until growth reaches their deterministic development time. Every
  eligible candidate is recorded with status `selected`; `retired`, `blocked`,
  and `unreachable` are invalid contract states. Persisted `birthProgress`
  means development history recorded, not visible branch emergence;
  `matureProgress` remains the timing-policy milestone validated with that
  record. The release-V1 lineage record schedule retains its `[0.28,1]` latent
  timing domain, while the user-observable lifecycle now starts at `0.5`. This
  means the initial half-form legitimately includes every parent-causal record
  due by `0.5`; it does not rewrite the exact-once record contract. The root is
  recorded at `0`; non-root record readiness begins at the latent `0.28` floor.
  The former normalized role spans are scaled across that `0.72` record range:
  readiness is trunk `0.00432`, scaffold `0.0648`,
  twig `0.072`; persisted policy span is trunk `0.1296`, scaffold `0.1584`, twig
  `0.1296`. Deep development times are capped at `.94`, so every candidate is
  recordable and fully present by growth `1`. Exact-once child recording remains
  parent-causal. The retained score policy writes bounded observation
  provenance but cannot affect membership. Normalization recomputes timing and
  closure. Before release, changing these semantics means replacing the exact
  accepted contract and clearing local development state rather than adding a
  read-time migration.
  `ZenBonsaiProfileAggregateModel` issues the positive monotonic
  `identityRevision`; a complete seed/mode/depth/latent/generation-input commit
  advances it exactly once. That revision is deliberately excluded from the
  tree-identity fingerprint. `ZenBonsaiClassic2IdentityContract` is the single
  canonical fingerprint implementation, while the nested lineage must carry the
  exact active identity revision and fingerprint. The aggregate carries a separate monotonic
  `stateRevision` (`1` at first bootstrap, then `+1` for each committed identity
  or lineage change) for transaction/CAS ordering. A complete identity commit
  clears the old lineage in that same CAS, so an older context cannot merge the
  old tree's growth into a new fingerprint. Both revisions are epoch-local: the
  aggregate's top-level `profileEpoch` must equal the reserved durable epoch row
  in the same transaction, so a reset may restart revision numbers without
  reviving an old writer. A module-branded prepared-candidate value
  validates and fingerprints the graph once per topology/identity input and is
  shared by runtime admission plus repository retries. Carrier metadata is
  extracted from that same candidate and cannot be inferred from unvalidated
  state. Logical graph extraction admits at most 2,400 candidates; its separate
  render-topology walk admits at most 2,448 physical nodes. Summary diagnostics
  do not change persisted shape: `pendingCount` means the deterministic
  development time has not yet been reached. At growth `1`, `selectedCount`
  must equal candidate count and `pendingCount` must be zero.
- `src/themes/plugins/zen/model/classic2/ZenBonsaiClassic2LineageScoringPolicy.js`:
  owns the retained pure `classic2_candidate_score_v1` structural observation
  contract. It
  precomputes parent/cohort fill, fixed parent-local attach/angle bins, parent
  cross-section/mass load, and scaffold side mass from the existing candidate
  graph and already-recorded decisions. It combines those signals with the already
  mapped canonical growth segment/imprint; it does not own storage, topology,
  activation, latent learning, or a second energy history. Score provenance
  names the model/feature versions, canonical input source, input fingerprint,
  bounded signals, and weighted contributions. Those values cannot select,
  retire, block, or delete candidate branches.
- `src/themes/plugins/zen/model/classic2/ZenBonsaiClassic2DevelopmentModel.js`:
  owns `classic2_wood_presentation_v1`, the deterministic projection from
  development records into shoot emergence, extension, girth, and stable terminal
  carriers. It normalizes the lineage state and requires one of two named wood
  clocks. `persisted_history` uses `maxObservedGrowth` for current Home;
  `ephemeral_scrub` uses `min(currentLifeGrowth,maxObservedGrowth)` for an
  isolated First Vision, Main qualified-use debug, or Experiment lineage. It computes emergence as
  `max(persistedBirth,parentReadyProgress)`, and keeps extension/girth ages
  separate. Trunk record/emergence position samples the fixed 30-step release
  reference, while extension uses one continuous global-arc frontier and one
  additive integral profile shared by every physical span. A span only queries
  that profile with its exact render arc, so adaptive subdivision cannot add
  maturation intervals, create extra growth frontiers, or change total visible
  extension. For trunk nodes it keeps
  scheduled `naturalGirthAge`, applies the
  exported shared mass knots plus local joint continuity, and publishes the
  visible-width-normalized `girthAge` and `trunkMassScale`. Stable terminal
  maturation is capped at `birth+.11` for leaves and
  `birth+.14` for flowers, so a bud may develop while its carrier twig continues
  extending without moving carrier birth. A selected but not-yet-emerged node is absent from the materialized
  topology and counted in `lineagePresentationPendingNodes`; its visible parent
  can remain a lineage frontier. The model emits both
  `developmentRecordProgress` and `shootEmergenceProgress` and records any
  projection lead without applying it. It does not write the lineage state,
  invent candidate geometry, or accept activation as structural time. Scrub
  changes only the displayed subset; it never lowers durable history.
- `src/themes/plugins/zen/contracts/ZenBonsaiClassic2IdentityContract.js`,
  `src/themes/plugins/zen/contracts/ZenBonsaiClassic2CandidateGraphContract.js`,
  `src/themes/plugins/zen/model/ZenBonsaiProfileAggregateModel.js`,
  `src/themes/plugins/zen/bonsai/storage/ZenBonsaiProfileAggregateRepository.js`,
  and `src/platform/storage/themes/zen/ZenBonsaiProfileAggregateStorageContract.js`:
  respectively own canonical fingerprinting, the exact role-aware candidate
  descriptor/trunk-arc contract, complete identity/lineage mutation, persistence,
  and exact stored key/shape validation for the single current-tree
  aggregate under `zen_bonsai_profile_aggregate_v1`. The exact record co-locates active
  Sakura identity, identity fingerprint, nested lineage, `identityRevision`,
  `stateRevision`, and durable `profileEpoch`. The reserved ModelState epoch row
  is the canonical reset generation; the aggregate field is its CAS fence. Only
  the explicit extension-lifetime first-run owner may bootstrap a missing key,
  and only when both aggregate and reserved epoch are physically absent under the
  initial lifecycle generation. Bootstrap writes both in one IndexedDB transaction;
  any installed epoch without its aggregate, or disappearance after hydration, is
  `ZEN_BONSAI_PROFILE_AGGREGATE_DISAPPEARED`. Corruption and same-identity
  candidate graph drift fail loudly.

  Active identity and nested lineage both carry
  `classic2_macro_lineage_graph_v2`. Because that value participates in the
  identity fingerprint, an explicit graph-contract cutover cannot be mistaken
  for same-identity generator drift. The candidate-graph contract module is the
  only descriptor-key/semantic validator; it requires exactly one macro root,
  exact reverse `childIds`, valid role/depth transitions, no cycle, and complete
  root reachability before resolving the root or graph fingerprint. Candidate
  preparation, lineage hydration, and physical aggregate storage consume that
  same whole-graph result. A biological macro descriptor/attachment
  semantics change must update this contract and clear the pre-release profile
  through the canonical reset flow. Repartitioning the same guide into another
  valid adaptive span set changes only the non-persisted render binding and must
  not rotate/reset lineage. Read-time repair, legacy descriptor acceptance, and
  implicit identity rotation remain prohibited.

  The articulated-bend and guide-handle cutover is the current V2 graph
  boundary because it may change guide shape and station-root attachment for an
  otherwise unchanged active identity. The reserved profile development
  baseline is therefore `2`; baseline `1` reaches the reset-only recovery
  surface before its stale aggregate is deep-hydrated. The exact cubic carrier
  alone remains non-persisted render binding derived from the already
  fingerprinted guide shape.

  The exact generation-input tuple includes nullable
  `spineGenerationConditionId`. Genesis and the ordinary durable default start
  at `null`. A direct guide or reference-family draft resolves a typed non-null ID
  only in its isolated ephemeral generation identity; changing that ID changes
  the identity fingerprint and bootstraps the next preview with
  `ephemeral_preview_identity_rotation`. If a durable canonical identity is
  supplied, its condition must exactly match the active generation condition;
  the runtime cannot overlay a draft condition or silently reuse the old
  lineage.

  A complete seed/latent/structure/generation-input change verifies the expected
  active identity, advances identity/state revision exactly once, and clears the
  prior lineage in one CAS. Nested lineage commits verify that exact new revision
  and fingerprint. Strict read/normalization and synchronous proposal computation
  happen outside IndexedDB. A short typed CAS commits only while
  `expectedRevision` still matches. Conflict `latestValue` is strictly normalized
  and becomes the resolver's next input for at most four attempts; an
  exact-reference no-change result uses verify-only CAS. Malformed conflicts and
  retry exhaustion are terminal, and there is no transaction-resolver fallback
  that can overwrite newer max-growth or exact-once records. The nested lineage
  accepts only `classic2_development_lineage_release_v1`; the aggregate has no
  schema classifier, policy migration command, old-key read, dual write, or
  historical interpretation. The old tree's carrier map is never applied to the
  new tree.

  Full reset first uses the session lifecycle generation to close/drain
  cross-context writers. The background composition adapter prepares the new
  generation aggregate, then model state clear, the same `resetId` reserved epoch,
  and that aggregate commit in one IndexedDB transaction. The session
  fence is admission/notification; the durable epoch transaction is the TOCTOU
  linearization point.
- `src/themes/plugins/zen/runtime/classic/useZenBonsaiClassic2LineageRuntime.js`:
  makes the current-runtime Home scene durable and keeps experiment plus named
  first-vision/debug/read-only presentation scenes ephemeral. Main rendering
  prepares the current candidate, supplies the synchronous different-identity
  rotation resolver when needed, then waits for
  the exact candidate lineage state to be validated and committed.
  A presentation scene may materialize an in-memory lineage for its own frame,
  but it cannot advance `maxObservedGrowth` or decisions in the durable
  aggregate.
  The return to current runtime starts a fresh durable admission. A storage or
  validation failure must not downgrade to ephemeral lineage or the old
  depth/hash birth model.
- `src/themes/plugins/zen/runtime/classic/zenClassicWorkspaceRuntimeConfig.js`
  and `zenBonsaiClassic2LineageRuntimeMode.js`: the workspace config owns
  Classic2 surface/lineage selection; the exact lineage mode then derives the
  only valid Classic2 wood clock. G15.4 owns Home/default Experiment topology;
  an explicit Classic2 Experiment comparison uses ephemeral lineage and
  `ephemeral_scrub`. `ExperimentWorkspace` owns only the local selector value and
  resets it to G15.4. Experiment seed/latent/structure/learning edits
  live in a page-local authoring draft; only `Apply to Main` commits one complete
  identity through one aggregate CAS. Legacy `classic` remains an explicit lab
  comparison, not a Main or default-lab growth owner.
- `src/themes/plugins/zen/model/sakura/sakuraRenderer.js`: owns shared Canvas/Pixi
  pot, soil, moss, nebari roots, and trunk-contact presentation. For lineaged
  Classic2, root reach/mass use projected root `girthAge` and root-base width
  starts from the actual projected trunk width. Root geometry is keyed by
  immutable tree/morphology/pot identity; a separate surface seed adds moss
  state and saturation without moving roots. BACK owns pot soil, root toes,
  moss, and soil join before the tree; FRONT owns only glazed pot occlusion.
  `showGroundBranchShadow` controls only the optional shadow, not pot/nebari
  admission. No renderer/backend may add a second opaque trunk flare or root-bed
  mass.
- `src/themes/plugins/zen/bonsai/state/ZenBonsaiExperienceModel.js`: current
  `FULL_DAY_ANCHOR = 10` and guaranteed progress math are allowed only as
  first-week warmth/presentation easing. They must not overrule
  `bonsaiRelease`, fabricate qualified use, or create a visible full-form bonsai
  before canonical day 5.
  For a scored habit signal plus cultivation state, this owner also creates the
  ephemeral activation presentation from score ratio and sample reliability;
  it does not pass the activation ratio into lineage or the wood schedule.
- `src/themes/plugins/zen/bonsai/rendering/useZenBonsaiRenderSystem.js` and the
  Classic Home workspace runtime only transport that normalized activation
  presentation into the scene snapshot/render options. They do not recompute
  its score, band, reliability, structural age, or bake cohort.
- `src/themes/plugins/zen/model/bonsai/presentation/ZenBonsaiActivationPresentation.js`:
  owns strict activation normalization, reliability attenuation, and
  low/steady/high band derivation. The expressed signal uses trust
  `.58 + .42*reliability`; this is a presentation value only and is never
  persisted as branch history.
- `src/themes/plugins/zen/model/sakura/sakuraLifeMood.js` and
  `src/themes/plugins/zen/model/sakura/sakuraRenderBranchLayer.js`: consume the
  normalized activation presentation for scale, saturation, brightness,
  tilt/droop, bud swelling/openness, stable keyed blossom-opening cohorts, and
  visible lineage-frontier buds. In the bounded life-growth `.48..72` hand-off,
  the renderer may also express a keyed temporary frontier blossom; this cue is
  not a structural carrier and disappears as real carriers take over. The structural terminal and its developmental
  stage remain immutable inputs; these consumers may return an ephemeral
  presentation-stage override (including a bounded bud-to-half-open cohort) but
  may not mutate that source stage or create/delete a carrier.
- `src/themes/plugins/zen/runtime/zenBonsaiSceneSnapshot.js`: owns activation
  invalidation granularity. The scene runtime signature observes ratio `.01`
  and reliability `.05` steps; the branch-rig bake signature observes band plus
  an expressed-signal `.1` cohort. The Pixi branch-rig baker consumes the same
  cohort through `resolveZenBonsaiActivationBakePresentation()`; raw activation
  remains available only to runtime tint/droop. The dispatch-level scene
  signature also includes the bake signature, so worker deduplication cannot
  discard a required cohort rebuild. Pixi defers branch sag while baking and
  applies life/imprint/activation sag once in the live transform. Static back/front layer
  signatures do not take activation. This keeps visible within-band response
  without cache-entry history changing baked textures or raw score noise causing
  unbounded rebakes.
- `src/themes/plugins/zen/model/ZenBonsaiHabitSignal.js`: tone ← tier
  (recovery overlay → `recovering`) when vitality is active.
- Structural consumers: the current bridge consumes projection-level structural
  fields and stamped segment choices in `projectZenBonsaiGrowthNode` and
  `sakuraRenderBranchLayer`. Future generator-time segment work may move those
  fields deeper into
  `src/themes/plugins/zen/model/bonsai/generation/growthDecayPolicyModel.js`
  and `src/themes/plugins/zen/model/sakura/sakuraBranchGenerator.js`; those
  consumers must still not compute values from raw stats.
- Renderer (partial): milestone/recovery tip accents, dew glint, leaf-fall
  cues, and discrete moss states are implemented through growth projection and
  classic sakura renderers. Follow-up renderer work should focus on timing,
  consume-once ceremony ownership, and long-form stamped structural events.

## 7. Edge cases

- **Goal edited mid-week**: `declaredGoal` changes immediately for future
  runtime friction, but closed-day outcomes are not retroactively rescored.
  `creditRef`/`deductRef` are rebuilt from the current policy lens when the
  next day outcome is computed.
- **Goal raised far above baseline**: allowed as a runtime commitment, but
  positive bonsai outcome still requires usage below `creditRef`.
- **Goal lowered far below baseline**: allowed as an aspiration; damage uses
  `deductRef = max(goal, min(0.70 * B, 2.00 * goal))` so the tree demands
  progress instead of instant perfection without letting the personal baseline
  override the authored goal without a bound.
- **Only recent 7-day trend exists**: use it for tentative copy only. Do not
  make it a hard cap or a scoring source.
- **No rules configured** (observation/quiet modes): neutral drift only —
  matches current quiet behavior. No structural growth is awarded.
- **Rules configured but no meaningful exposure**: neutral drift only. A
  registered domain without managed active minutes or protected visits proves
  intent to watch something, but it does not prove restraint.
- **Unused or irrelevant domain**: no shame and no reward. The domain may stay
  configured, but bonsai growth must wait for actual contact with protected
  surfaces.
- **Optional artifact disabled**: do not penalize the user for disabling a
  ceremony. Process credit can come from any trusted protection outcome; visual
  artifacts only change how that process is expressed.
- **Repeated hard-reset collapse**: preserve user agency over the low goal, but
  copy must frame the pattern as strain/recovery. Structural imprint may show
  compression or kink on new segments; it must not permanently ruin the tree.
- **Vacation/absence**: drifts to steady, growth pauses, no punishment.
- **Thriving requires ongoing tension by construction**: only days that beat
  the personal norm (or carry practice) push H up; maintenance and absence
  both settle toward the steady center — no extra anti-idle rule needed.

## 8. Test plan sketch

- State-law unit tests: the invariant table in §2.1, verbatim.
- Ledger tests: loose-goal exploit (goal 60 / usage 30 daily) yields no
  positive `d` stream once `B` converges; blowout-on-one-site cannot be
  averaged away; exposure gate produces neutral days.
- Limit-governance tests: goal above `1.25 * B` stays editable/runtime-visible
  but produces neutral adherence at typical usage; goal below `0.70 * B` uses
  the softened deduction reference; missing baseline keeps the bonsai growth
  outcome neutral rather than inventing an app target.
- Evidence-fairness tests: no configured rules, unused registered domains, and
  non-engaged days produce neutral drift/no structural growth; a protected
  visit plus honored friction can produce practice credit even when optional
  ceremony visuals are disabled.
- Hysteresis tests: mild slip does not change tier; tier transitions only at
  day close; recovery overlay fires on day 1 after damage + one good day.
- Release-growth tests: canonical qualified-use day 5 reaches growth `1` even
  under low habit scores and same-day appearance caps; debug projection cannot
  write lineage or cultivation. Cultivation-memory tests separately cover pause
  under low H, dieback cap, milestone accents, and missing-state bootstrap.
- Bridge projection tests: seedling/juvenile retain twig/terminal life while
  staying thinner and smaller than mature form; terminal distance/scale shrink
  with young branch projection; mature/display final form remains stable.
- Growth-event tests: vitality milestone presentation is preserved on
  `lifeState.growthEvent`; projection signatures include milestone/recovery
  event fields; renderer consumes only projection event fields.
- Surface-feedback tests: micro-feedback projects to dew/leaf-fall cue fields;
  moss state remains a projection-level vigor read; renderer consumes only
  projection surface fields.
- Structural-imprint tests: first 7 evidence days cannot stamp kink/compression
  penalties; cultivated strained vigor increases projection-level
  `kinkPressure`/`scaffoldCompression`/`gravityBias`; recovery after a slip
  increases `recoveryShootBias` without pretending the whole tree instantly
  matured.
- Classic2 lineage/presentation tests: the exact development-lineage contract
  and timing are strict; persisted mature mismatches fail normalization; historical
  or malformed record shapes fail without rewrite; exact prepared carrier
  metadata is required; different identities cut over directly to a validated
  fresh release proposal while same-identity tree/carrier drift remains
  fail-loud; projection phase
  lead never advances `maxObservedGrowth`; Home stays persisted-history while
  high→low→high Experiment scrub is reversible; emergence respects persisted
  development time plus role-specific parent readiness; growth `1` fully
  matures every candidate branch; extension/girth ages and stable terminal
  carrier birth stay activation-independent.
- Classic2 observation/distribution tests: distal continuity, parent support,
  local clearance, sibling demand, canonical-history mismatch, and side-mass
  signals move in their named direction without changing branch membership;
  5-seed × 5-history sequential replay remains exact-once, monotonic,
  parent-closed, history-topology-invariant, and records state-size envelopes.
- Activation/bake tests: ratio/reliability normalization and bands fail loudly
  on malformed input; keyed blossom cohorts remain deterministic; runtime
  signatures observe `.01/.05` steps while branch-rig bake signatures change
  only at band or expressed-signal `.1` cohort boundaries; the juvenile
  frontier cue stays inside its handoff window, below cohort `.32`, and returns
  `half_open` only.
- Shared Sakura surface tests: lineaged nebari requires projected root age/girth
  age, root reach/mass use the girth clock, geometry seed stays stable across
  moss states, surface seed may change with moss, and Canvas/Pixi keep nebari in
  BACK with only pot-front occlusion in FRONT.
