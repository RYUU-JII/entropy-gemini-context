# Personal Baseline Boundary Map

- Status: Active
- Owner: cross-domain personal baseline contract / domain-specific interpretation owners
- Last validated against code: 2026-09-14
- Path policy: current-only
- Canonical for: app-wide personal baseline vocabulary, observation semantics, owner paths, decision boundaries, and persistence policy
- Companion to:
  - `docs/architecture/repository/site-pull-pattern-boundary-map.md`
  - `docs/architecture/repository/clse-boundary-map.md`
  - `docs/architecture/repository/storage-stats-tracking-boundary-map.md`
  - `docs/architecture/storage/storage-architecture-target.md`

## Purpose

Current Sites exposure uses a read-only activity-day presentation trajectory,
excluding the in-progress activity day and counting actual collection evidence.
`sitesGlobalExposureAverageReadModel.js` owns that projection;
`statsSitesSnapshotReadModel.js` composes it. Basic strategy accepts explicitly
tagged completed calendar-day or completed activity-day provenance and excludes
the current period in both cases. Sites recommendation review is owned by
`SiteGoalRecommendation.jsx`; `SiteDecisionWorkspace.jsx` composes its explicit
confirmation flow and consumes the supplied view model.

The consumption-cadence cutover removed Feed Tempo from the production graph.
The Feed Tempo contracts below describe retained research modules and checkpoints;
they grant no production observation, persistence, detector or admission authority.
The current activation boundary is documented in
`docs/architecture/runtime/feed-flow-runtime-target-architecture.md`.

Personal baseline is a family of user-relative facts, not one app-wide number.
Each profile answers a bounded question for one metric, scope, and exact grain:

```text
observed user facts
  -> explicit observations and eligibility
  -> descriptive personal profile
  -> confidence/status gate
  -> optional bounded decision reference
  -> consumer evidence or score
```

The shared contract standardizes what those stages mean. Domain adapters still
own metric selection, exposure, evidence thresholds, and product decisions.
There is one vocabulary and one robust stats profile builder, but there is no
cross-domain aggregate "personal baseline score."

## Non-Negotiable Policy

1. A descriptive baseline and a prescriptive decision are different objects.
   Observed history may explain what is usual; it cannot declare that history
   desirable.
2. Metric identity includes its exact grain. A `day`, `bucket_10s`, and
   `bucket_60s` profile must never compare or update one another.
3. Observation state is explicit. Missing, observed zero, and observed but
   ineligible are not interchangeable.
4. A profile is learned only from earlier eligible observations. Completed-day
   profiles exclude the current day; streaming profiles compare a completed
   bucket before learning from that bucket.
5. Sparse or invalid canonical state is surfaced as an explicit status or loud
   contract error. Another metric, grain, storage path, or default profile must
   not silently replace it.
6. Raw facts and settings remain their canonical authorities. A computed
   profile is a projection unless this map names a materialized owner.

## Shared Vocabulary

`src/lib/personalBaselineContract.js` is the side-effect-free vocabulary owner.
`src/lib/index.js` is its general public entrypoint, while
`src/domains/stats/baseline/index.js` re-exports stats-owned aliases and the
common profile builder.

### Roles

| Role | Meaning | May learn from observations? | May prescribe a decision? |
| --- | --- | --- | --- |
| `observed_baseline` | Robust descriptive distribution of eligible user history | Yes | No |
| `recent_trajectory` | Recent weighted direction or pressure projection | Yes, in its own declared window | No |
| `adaptive_reference` | Bounded interpretation reference derived from observed facts plus policy | No write-back to observed history | Yes, within an explicit cap |
| `normative_anchor` | User goal or product policy independent of personal history | No | Yes |

### Profile statuses and decision modes

- `sparse`, `forming`, and `stable` are the shared evidence-maturity statuses.
  Each domain owns the evidence thresholds, but it does not redefine the
  vocabulary.
- `normative_only` and `bounded_adaptive` are the shared score-reference modes.
  The former uses only the normative anchor; the latter admits a sufficiently
  supported observed baseline under a named cap.

### Exact metric grains

- `day`: completed activity/calendar-day observations owned by the metric
  adapter.
- `bucket_10s`: completed CLSE 10-second observations.
- `bucket_60s`: completed CLSE 60-second observations.
- `paged_item_dwell`: visible dwell closed by the next confirmed transition on
  the same canonical paged-feed surface. The first transition starts
  observation, and an episode's trailing open dwell is censored rather than
  inferred.

Only currently implemented vocabulary belongs in the shared contract. Adding a
new role, grain, or direction requires a real consumer, this map, and
`check:personal-baseline:architecture` to change together.

## Common Metric Profile Contract

`src/domains/stats/baseline/personalBaselineCore.js` owns robust distribution,
confidence, reference, and anomaly math. Consumers import it through
`src/domains/stats/baseline/index.js`. That public seam exposes the strict
profile builders and contract enums. The narrow
`derivePersonalBaselineMetricAnomaly()` helper is the sole exception: it lets a
strict reader re-derive the producer's kind-aware anomaly semantics. Low-level
percentile, robust-stat, and confidence helpers remain implementation details so
consumers cannot assemble a second partial producer.

A descriptor must declare:

```text
id, kind, family, unit, grain, direction, scope, exposureUnit,
observations, current, metricVersion, policyVersion, provenance
```

Every observation declares:

```text
observed: boolean
eligible: boolean
value: finite non-negative number | null
exposure: finite non-negative number
```

The emitted profile keeps one flat canonical identity and includes
`role=observed_baseline`, versions, provenance, `currentObserved`, current
eligibility/value/exposure, sample counts,
robust stats, reference facts, anomaly facts, confidence, and its gate.
There is no parallel nested identity or second sample vocabulary.
`currentObserved=false` remains distinct from an observed but ineligible current
fact; both have `value=null` and zero exposure, but only the latter is known.

Confidence is derived from that same canonical sample. Time metrics combine
eligible-day coverage, positive activity, volume, and robust stability;
interaction/value/ratio metrics combine coverage and event evidence. Adapters
may tune named targets but may not submit a second confidence sample DTO.
For count/value metrics, repeated eligible zeroes contribute observation
exposure to confidence without being rewritten as positive events; otherwise a
well-observed zero baseline would be incorrectly treated as missing evidence.

Canonical sample fields are:

```text
observedCount, eligibleCount, ineligibleCount, missingCount,
exposureTotal, positiveCount, valueTotal
```

### Zero, missing, and ineligible

| Input state | Canonical observation | Interpretation |
| --- | --- | --- |
| Fact was not collected | `observed=false`, `eligible=false`, `value=null`, `exposure=0` | Missing; it cannot teach the profile |
| Zero is meaningful and exposure exists | `observed=true`, `eligible=true`, `value=0`, positive exposure | A real zero in the distribution |
| Fact exists but its denominator/evidence is insufficient | `observed=true`, `eligible=false`, `value=null`, `exposure=0` | Known but ineligible; it cannot become a zero |

Adapters own the eligibility rule. For example, a ratio with no denominator is
ineligible. Usage scoring intentionally models a user's engaged-day duration,
so a completed zero-use day is observed but ineligible for that profile. These
choices must be named policy, not coercion inside generic math.

## App-Wide Owner Map

| Concern | Role/classification | Canonical owner | Facts and output | Boundary |
| --- | --- | --- | --- | --- |
| Shared roles, grains, directions | contract vocabulary | `src/lib/personalBaselineContract.js` | frozen current-only constants | no domain policy or math in the vocabulary file |
| Robust metric profile | `observed_baseline` | `src/domains/stats/baseline/personalBaselineCore.js`, public seam `baseline/index.js` | strict descriptor to robust profile | no deep consumer imports of the core file |
| Site Pull | observed baseline plus separate trajectory/reference policy | source contract `src/domains/stats/insights/sitePull/baselineSeriesSource.js`; producer/read path `statsSitesSiteDetailQueryService.js`, `statsSitesSiteDetailReadModel.js`, `statsSiteIntelReadModelHelpers.js`; metric producer `personalBaselineMetrics.js`, `personalBaseline.js`, `personalBaselinePolicy.js`; strict public projection `personalBaselinePublicContract.js` | exact 30 completed calendar-day site duration, visits, revisit, switching, rates, and session-shape profiles | source date and series are mandatory; metrics map is the input authority; flat summary is a derived public projection |
| Usage scoring baseline | `observed_baseline` | `src/domains/stats/analysis/usageBaseline.js` | 28 completed-day engaged-use profiles for global and site rules | current day excluded; no local median/MAD/recency algorithm |
| Score decision reference | `adaptive_reference` or `normative_anchor` decision | `src/domains/stats/analysis/scoreRuleReference.js`, consumed by `scoreLedger.js` | explicit `normative_only` or `bounded_adaptive` reference | observed baseline never replaces the goal and is never mutated by scoring |
| Score Setup target draft | completed-day `recent_trajectory` input to an `adaptive_reference` draft | `src/domains/stats/analysis/scoreSetupRecommendations.js`; candidate attachment in `statsSiteIntelReadModelHelpers.js`; canonical review UI in `SiteDecisionWorkspace.jsx` | exact seven completed calendar-day domain-active trajectory plus a bounded editable target draft | current partial day is excluded; a draft never writes a goal automatically; the per-site save requires review and a second inline confirmation |
| Rules site trend | `recent_trajectory` | `src/domains/stats/insights/sitePull/personalBaselinePolicy.js`, projected by `buildSiteInsightModel.js` through `analysis.featureSummary`; app presentation owner `src/apps/dashboard/tabs/sites/presentation/targetPanelViewModel.js` | canonical Site Pull recent-trajectory direction and exact target-panel view model | `buildSiteFeatureVector` and the app presenter do not recalculate prior-vs-recent baselines; theme widgets do not import stats contracts |
| Basic protection recommendation | completed-day `recent_trajectory` input to an `adaptive_reference` suggestion | fact adapter `src/domains/protection/domain/basicProtectionRecentTrajectory.js`; exact DTO owner `src/domains/protection/strategy/contracts/basicStrategyContextContract.js`; policy `src/domains/protection/strategy/catalog/basicStrategyPolicy.js`; runtime assembly `protectionRuntimeDecision.js` | exact previous seven completed calendar days, observed-day average, and a review-only banded recommendation that may also consider today's partial usage | missing date and observed domain zero stay distinct; recommendation never changes the declared target; Basic runtime is fixed to `stabilize` and effective target equals declared target |
| CLSE online profiles | materialized `observed_baseline` | `src/domains/behavior/detection/BaselineManager.js`; lifecycle policy `src/domains/behavior/clseBaselineStatePolicy.js`; persisted shape `src/platform/storage/clse/clseBaselineStorageContract.js`; read shape `src/domains/behavior/clseBaselineReadContract.js` | same-grain Huber-bounded evidence/feature mean/variance, with read-time confidence and status | 10s/60s profiles are separate; compare before observe; derived maturity is revalidated and not persisted |
| Feed tempo persisted shadow profile | cross-session `observed_baseline` evidence projected from a durable adaptive checkpoint plus bounded `adaptive_reference` evaluation | content owner `src/domains/nudge/feed-flow/tempo/FeedTempoEpisodeAssembler.js`, `FeedTempoProfileLearner.js`, `FeedTempoRuntime.js`; background update owner `FeedTempoPersistentProfileService.js`; typed storage owner `src/platform/storage/model/FeedTempoProfileCheckpointRepository.js` | content-free `paged_item_dwell` episode facts, per-domain/semantic-surface decayed profile, and observe-only pace evaluation | confirmed FeedFlow advances are reused without a second observer; compare before observe; only eligible unassisted episodes enter an epoch-fenced CAS checkpoint; candidate/exposed and censored samples never write; checkpoint persistence grants no detector/admission/actuation authority |
| CLSE detection sensitivity | prescriptive decision policy | `src/domains/behavior/detection/clseDetectionPolicy.js`, created from the service-owned setting in `CLSEService.js` | exact sensitivity DTO and monotonic absolute/positive-z threshold scaling | it is never stored on `BaselineManager` or included in descriptive baseline evidence/DTOs |
| Rolling pressure | `recent_trajectory` | `src/domains/stats/analysis/rollingPressureModel.js` | recency-weighted active-time pressure plus an exact per-domain completed-activity-day trajectory DTO | the current activity day may affect pressure ranking but is excluded from its comparison reference; it is not an observed robust baseline or goal |
| Sites HUD weekly average | read-only completed activity-day adjustment context | `src/domains/stats/background/query/sitesGlobalExposureAverageReadModel.js`, consumed by `SitesHud.jsx` | `{ averageMs, observedDayCount, windowDayCount, windowStartDateStr, windowEndDateStr, resetHour }` over the last seven completed activity days; only recorded days enter the denominator; no evidence is `null`, observed zero is `0` | fixed-axis comparison only; not a personal baseline, score reference, automatic goal, or writable policy |
| Cycle/wake inference | rhythm profile | `src/domains/tracking/background/cycleRecommendationService.js`, `src/lib/sleepPattern.js` | sleep-gap/wake-hour estimate and reset recommendation | circular temporal structure is not forced into a scalar baseline role |
| Dopamine binge evidence | not personalized | `src/domains/nudge/attention/dopamineBingeDetector.js`, `dopamineBingeEvidenceRuntime.js` | current reward/feed episode evidence only | the feed-tempo profile is shadow-only; no personal lift enters this detector or Enso admission until a separate bounded consumer decision is approved |
| Zen model/golden baselines | excluded | Zen model/render/testing owners | model state, visual calibration, replay fixtures | the word "baseline" here does not mean a user-behavior personal baseline |

The Site Pull public projection retains one release invariant: flat summary fields are derived from the metric authority and are never accepted as a second input shape. `personalBaselinePublicContract.js` owns this read boundary independently from the producer. The aggregate baseline envelope, metric map, metric sections, policy, recent trajectory, and adaptive reference are exact whitelist DTOs; unknown top-level fields, unknown producer IDs, and stale nested fields such as a metric-level `trend` are rejected at the projection boundary. Each metric ID is also checked against its canonical definition for family, kind, unit, grain, direction, scope, exposure unit, versions, provenance, and confidence gate. A shape-valid DTO cannot relabel a known metric, forge its anomaly semantics, or replace a canonical derived trajectory field.

## Domain Algorithms

### Site Pull

`site-pull-personal-baseline-v3` and
`site-pull-personal-baseline-policy-v3` name the strict metric/anomaly,
calendar-window trajectory, and adaptive-reference contract described here.

Site Pull constructs named daily metric descriptors, delegates robust math to
the stats baseline core, and then derives consumer evidence from the named
metric map. Its recent trajectory and adaptive reference are explicit policy
layers. They do not write into the observed metric distributions.

`deriveSitePullRecentTrajectoryProjection()` is the only Site Pull trajectory
policy algorithm. `buildSitePullRecentTrajectory()` is its raw-series adapter;
it slices the full completed-calendar series into recent seven-day, momentum
three-day, prior, and comparison six-day windows before excluding missing
observations. Missing slots are never converted to zero and older observations
never slide forward to fill a recent window. The adapter then extracts the
canonical observed-only summary inputs and delegates every prior-vs-recent
ratio, momentum/reference ratio, dispersion/volatility score, single-day-spike
score, state, and caveat decision. Its current-inclusive comparison summary
carries comparison-day and active-day counts, recent total, previous recent
maximum, today's value, and today's recent-window share. Observed metric
profiles do not carry a dormant trend field; adaptive reference, scoring,
pattern evidence, `analysis.featureSummary`, and the Rules target panel consume
the policy projection. `temporalEvidence` owns only today's context plus
reentry, residency, tab, navigation, and cycle facts; it does not consume a
personal baseline or produce direction. A supplied profile facts DTO must
already carry both objects; profile evaluation never repairs either field by
rebuilding it.

The producer and public reader share the policy-only
`deriveSitePullRecentTrajectoryProjection()` and
`deriveSitePullAdaptiveReferenceProjection()` functions. The trajectory carries
its recent mean absolute deviation so the reader can re-derive its reference,
ratios, volatility, scores, confidence, state, and caveats from canonical metric
context. It also re-derives the current-day share and single-day-spike guard from
the canonical comparison summary, so presentation consumers never reconstruct
`recent3d`, `recent7d`, linear `weighted7d`, or a second robust trend z-score.
The adaptive DTO declares `referenceMode=normative_only` while the
baseline is sparse and `referenceMode=bounded_adaptive` otherwise; its state,
tightening cap, reference, confidence, and caveats are likewise re-derived.
In `normative_only` mode, `observedReferenceMs` remains descriptive evidence but
`referenceMs` is fixed to the named product minimum; sparse self-history does
not become a decision reference. Forming and stable evidence may use the
observed anchor only through the bounded-adaptive policy.
Changing a derived field while keeping a valid whitelist shape is a contract
error.

Metric anomaly semantics follow the same producer/reader rule.
`derivePersonalBaselineMetricAnomaly()` in the stats baseline public seam is the
single kind-aware anomaly derivation used by profile construction. The Site Pull
adapter supplies the metric's canonical anomaly options, and the public reader
re-derives rounded score, ratio, robust z, and confidence-gated `anomalyScore`
from current value/eligibility plus canonical stats/reference. A DTO cannot make
forged anomaly scalars authoritative. `computeSitePullProfile()` performs this
validation before feature reconstruction, scoring, pattern evaluation, or
diagnostics, then passes only the validated baseline inside its facts object.
The Site Pull reader also requires all metrics to agree on `currentObserved`
and completed-window observed/missing coverage.

`targetPanelViewModel.computeHabitScore()` is app-owned consumer scoring only. Its trend
contribution reads the validated `analysis.featureSummary` trajectory role,
comparison state, direction, and ratio. It never splits `weeklySeries` into
last-three/prior windows or treats `observed=false` entries as zero evidence.
Missing authority is `trendAuthorityState=absent`; a canonical but ungated
trajectory is `insufficient`. Both states produce no trend claim or trend-score
contribution, and the Rules detail UI does not label them as stable.
Its weekly total, active/over-limit counts, maximum, data state, and frequency
denominator share one observation-summary algorithm. `buildRuleSiteIntel()` is
the scalar producer; the Rules app presenter validates those scalars against the
same summary contract before consuming them. The streak uses the intact calendar
topology, so a missing slot ends continuity instead of joining active
observations across the gap.

`baselineSeries` and `baselineCurrentDateStr` form one mandatory Site Pull source
contract. An explicit empty series is the only sparse/no-history representation.
A non-empty source contains exactly 30 ascending calendar dates immediately
before `baselineCurrentDateStr`; the current partial day is forbidden. Every
entry declares `observed`. An observed zero is
`observed=true, activeMs=0`, while a missing stats day is
`observed=false, activeMs=null`. Missing fields, malformed entries, shortened
windows, gaps, reordered dates, and current-included windows fail loudly. The
adapter never substitutes `weeklySeries` and never guesses the current date
from the last entry.

For metric coverage, every Site Pull profile materializes exactly 30 target
slots. A non-empty source passes all calendar entries, including missing ones;
an analysis-tier empty source materializes 30 explicitly missing metric slots
without inventing trajectory dates. Every metric therefore satisfies
`observedCount + missingCount = 30` and all metric IDs share those counts. The
empty source still leaves trajectory `sampleDays=0` and state `insufficient`.

The selected-detail owner carries the current stats-day marker as
`todayObserved` through intel, feature vector, and facts. Metric, Site Pull top
level, and trajectory DTOs expose it as `currentObserved`. When false, current
metric facts are missing and trajectory comparison days, active counts, and
totals exclude the current slot. Numeric today compatibility fields are zero
with that marker; share, ratio, spike, and rebound remain zero and are never
interpreted as an observed zero.

The seven-day Site Pull `weeklySeries` is a separate observation contract. Every
entry must carry an explicit boolean `observed`; absence never defaults to true.
`observed=false` is missing evidence even if its normalized numeric payload is
zero, while `observed=true, activeMs=0` is an observed zero day and remains in
coverage denominators. `observedWeeklyDays`, weekly average, active/over-limit
day rates, habit regularity, score confidence, `hasWeeklyFacts`, requirements,
and diagnostics all derive from the shared weekly observation-summary contract. Facts rebuild
and public projection validate the count and weekly scalar relationships before
any scoring consumer runs. The canonical DTO still preserves all seven calendar
slots. Sequence and streak logic runs over that full topology, where a missing
slot breaks continuity; only non-sequential averages and rates use the compact
observed subset.

The selected Rules site-detail owner reads 31 calendar days—current plus the 30
completed baseline days—from the repository and evidence owners. It projects
the exact completed 30-day baseline and the seven-day weekly/current series as
separate consumers of one explicit union projection map. Only the weekly series
may contain `baselineCurrentDateStr`; the baseline never does. Analysis-only
snapshots that do not buy the 31-day detail read pass the explicit empty sparse
source instead of borrowing weekly history. Confidence and status gate how
strongly downstream detectors may state a personal claim.

### Usage baseline and score reference

`buildUsageBaselines()` builds one fixed 28-day completed-day window from stats
facts. It uses the common unweighted robust profile; recency weighting belongs
to a trajectory model, not the observed distribution. Its score-boundary reader
validates the full profile contract and the expected metric/scope identity, so a
valid site profile cannot be routed into the global rule or another site. A
present stats day must expose finite, non-negative numeric `active` facts for
matching domains. Malformed values are contract failures; they are never
coerced into an observed zero or an ineligible day.

The usage DTO carries the exact ordered 28 observation values that produced its
sample totals, robust statistics, confidence, and status. The compact encoding
is canonical: a positive number is an eligible engaged-day minute value, `0`
is an observed zero-use/ineligible day, and `null` is a missing day. The
score-boundary reader expands that evidence and runs the shared profile builder
again; every derived field must match exactly. A DTO containing plausible
sample and statistics scalars without its canonical observation evidence, or
scalars forged from a different history, fails loudly instead of becoming a
score reference. This keeps the shared robust-statistics builder as the only
math owner while making the transported projection independently verifiable.

`resolveScoreRuleReference()` keeps the configured goal as the normative
anchor. Missing or sparse observed history returns `mode=normative_only`. A
usable profile may return `mode=bounded_adaptive`:

```text
credit reference = min(goal, observed median)
deduction candidate = 0.7 * observed median
deduction cap = 2 * goal
deduction reference = max(goal, min(candidate, cap))
```

This permits gradual adaptation without normalizing an arbitrarily high usage
history into the product target. Decision math retains raw minute precision;
rounding belongs only to presentation, so a very small positive reference can
never collapse to zero and accidentally award full credit.

### Score Setup target drafts

`buildScoreSetupRecentTrajectory()` owns the Score Setup input DTO. It reads
exactly seven completed calendar days from `stats_dates_domain_active`, keeps a
missing day as `observed=false, activeMs=null`, and rejects the current or a
future day. The DTO is `version=score_setup_recent_trajectory_v2`,
`role=recent_trajectory`, `grain=day`,
`windowBasis=completed_day`, `excludeCurrent=true`; its sparse/forming/stable
status is derived from its own exact evidence and is revalidated at the
recommendation boundary. `sites_domain_candidate` is only the transport via,
not the fact source. A missing, malformed, relationally inconsistent, or
extra-field trajectory is a contract error; `weeklyTotal`, `recentAverageMs`,
or the current partial day never repairs it.

The DTO retains all seven canonical `{dateStr, observed, activeMs}` slots. The
recommendation boundary derives the excluded current date from the final
completed slot, reruns `buildScoreSetupRecentTrajectory()`, and exact-compares
the identity, evidence, status, totals, average, and slots. Summary scalars from
one seven-day history therefore cannot be paired with another history and
treated as authoritative.

The versioned `score_setup_recent_active_days_v1` policy is fixed:

```text
ready evidence = at least 3 active days and 45 total active minutes
recent active-day mean = completed-day total / active days
draft = clamp(round_to_5(0.85 * mean), 10, 180 minutes)
```

A ready result is `role=adaptive_reference`,
`referenceMode=bounded_adaptive`, and `workflowMode=review_draft`. Insufficient
evidence remains an explicit observing result with
`referenceMode=normative_only`, `workflowMode=observe_only`, and a named
insufficiency reason; it does not synthesize a target. Both modes include exact
provenance with `requiresUserReview=true` and `autoApply=false`. An existing
site goal is never replaced by recommendation generation. The canonical Rules
surface is the selected-site `SiteDecisionWorkspace`, not the retired orphaned
bulk panel. The first action places the proposed minutes in the editable daily
target control; editing cancels recommendation confirmation. An unchanged
proposal then requires a second inline action naming the domain, minutes, and
daily target setting before any settings command runs. The mutation boundary
accepts one reviewed site draft only; there is no parallel bulk-apply path.

### CLSE same-grain online profiles

CLSE owns two independent feature distributions: `bucket_10s` for spike and
aggression evidence, and `bucket_60s` for sustained-load evidence. Both cover
tab-switch rate, navigation rate, scroll volatility, and media-seek rate.

The ordering contract is one-step lag:

```text
completed bucket
  -> validate exposure and exact grain
  -> compare/detect against the earlier same-grain profile
  -> Huber-bounded online update with the completed bucket
  -> flush the typed materialized evidence/stat profile
  -> derive current sparse/forming/stable status and confidence on query
```

The learner verifies `bucket start + exact grain duration <= evaluatedAt`
before accepting even an ineligible observation. A future or still-open bucket
is a contract error and cannot create evidence that only the read boundary
would reject later.

The sustained detector commits its last-analyzed bucket marker only after the
same-grain reference evaluation succeeds. A transient reference failure leaves
the bucket retryable; it cannot silently consume the bucket before detection or
let learning advance without the comparison that was supposed to precede it.

The Huber bound limits a single extreme bucket's learning influence. It does
not hide the bucket from detection. Low-exposure buckets are explicit
ineligible observations and do not update feature statistics. A detector must
not borrow the other grain when its own profile is sparse.

The read DTO carries its `evaluatedAt` clock. The shared CLSE state policy uses
that clock to derive freshness, status, and all confidence components, and the
read boundary re-derives them after transport. Derived values are therefore not
trusted merely because their scalar ranges look valid; evidence/status,
component/overall, future-time, and aggregate contradictions fail the contract.

The runtime status projection also binds the sustained detector diagnostics to
that exact baseline summary. When a 60-second reference has been evaluated,
its `baselineStatus`, `referenceMode`, `baselineGrain`, and
`baselineResetEpoch` must match the summary's 60-second profile and aggregate
reset epoch. A normal operator-requested baseline-only reset quiesces the CLSE
runtime, reloads the rewritten baseline, and recreates detector state before
resuming that same worker. A profile reset or snapshot import is different: it
terminally quiesces the retiring worker, drains and flushes the old epoch, runs
the durable mutation, discards manager memory, and never reloads or resumes the
old collector graph. The extension runtime reload is the only owner allowed to
initialize the new profile generation. Cross-object contradictions fail the
status contract.

Detection is risk-only adaptive. Sparse and forming profiles use
`normative_only`; stable same-grain profiles may use `bounded_adaptive`. The
absolute product-risk score and detection remain a floor that personal history
cannot reduce or veto. Only positive same-grain z evidence may add lift, capped
at `0.20` for aggression channels and `0.25` for sustained-load severity.
Consequently, a chronically high personal history never normalizes behavior
that already crosses an absolute risk threshold.

Flush and reset mutations are serialized at the manager, and baseline plus
aggression-diagnostic writes share the repository's baseline-epoch order. The
store checks `reset_epoch` / `baseline_reset_epoch` in the same transaction, so
a delayed pre-reset snapshot cannot overwrite the replacement and an old-epoch
diagnostic cannot reappear after the atomic reset clear. Epoch mismatches are
explicit failures, not filtered missing data.

Sensitivity remains outside the descriptive model. `CLSEService` passes the
current canonical policy explicitly into both the 10-second aggression scorer
and 60-second sustained detector. The shared policy owner applies one meaning:
higher scale means higher decision and positive-z lift thresholds, while lower
scale means a more sensitive detector. Changing it cannot mutate baseline
samples, lifecycle state, confidence, or the transported baseline DTO.

### Retained Feed Tempo research profile

Feed tempo is a paged-feed, observe-only personal profile. It consumes the same
confirmed advances already emitted by `FeedAdvanceCoordinator`; it does not
mount another DOM observer, rescan candidate items, or retain item identity.
The exact grain is `paged_item_dwell`, scoped by
`profileId + semanticSurfaceId + surfaceMode + contentClass`.

The episode ordering contract is:

```text
first confirmed transition
  -> open a content-free episode
next confirmed transition
  -> close the prior item's visible dwell
visibility/surface/mode/idle/runtime boundary
  -> censor the open trailing dwell and finalize the episode
finalized episode
  -> evaluate against the earlier same-surface profile
  -> observe eligible unassisted dwell samples
```

The assembler uses one owned idle timer and visibility/media lifecycle events
already captured by FeedFlow. A raw item route change inside the same canonical
`semanticSurfaceId` does not split the episode. A semantic surface or effective
mode change does. Dwell below 250 ms, above five minutes, or attached to a
multi-item jump is censored. Candidate or exposed intervention episodes remain
diagnostic facts but are excluded from observed history so the system cannot
learn its own friction as the user's natural pace.

The transient episode fact retains the full eligible dwell count, active-time
sum, rapid count, and a fixed content-free numeric histogram. Its raw numeric
sample array is an explicitly labelled `ordered_tail` capped at 64 values, with
retained/dropped counts and coverage ratio. Median and quartiles describe that
retained window; whole-episode rate and rapid share use the full aggregates.
The fact also carries the inclusive 250 ms..five-minute eligibility window and
the exact two-second rapid threshold. Censoring is split into below-minimum,
above-maximum, multi-transition, and trailing counts; the trailing observed
duration remains diagnostic-only and never becomes baseline evidence.

`FeedTempoProfileLearner` compares before observing the current episode. It
keeps bounded per-surface samples and Huber-bounded online log-dwell statistics.
`sparse`, `forming`, and `stable` use the shared vocabulary. The normative
anchor is five seconds; personal history may bend the shadow reference only
inside `0.75x..1.25x` of that anchor. The observed distribution is descriptive
and never writes the adaptive interpretation back into itself.

The cross-session owner is a **persistent adaptive profile**, not a permanent
baseline. IndexedDB stores the latest online-learning checkpoint, not a fixed
truth about the user. Its current policy is exact and versioned:

- evidence weight has a 30-day half-life;
- confidence freshness has a separate 7-day half-life;
- one eligible episode may move the stored adaptive center by at most 4%;
- every evaluation remains anchored to the five-second normative reference and
  the `0.75x..1.25x` cap;
- only `eligibleForObservedBaseline=true`,
  `interventionState=unassisted` episodes with at least one valid dwell sample
  may mutate the checkpoint;
- candidate/exposed intervention episodes, censored trailing dwell, multi-jump
  dwell, and low-confidence episodes perform zero durable writes.
- a dev-only consumption-research write fence taints the episode active at
  research start; that episode performs zero durable writes even when the live
  fence is released before its later lifecycle finalization. The fence is QA
  isolation evidence, not a product baseline input or detector override.

`feed_tempo_adaptive_profile_checkpoint_v1` is one exact typed `model_state`
entry. It is fenced by the installed `profileEpoch` and updated with
`(profileEpoch, stateRevision)` compare-and-set. Each admitted episode is one
atomic checkpoint update; conflicts retry from the strict-normalized latest
value for at most four attempts. The checkpoint holds at most 16 canonical
surface profiles and 128 timestamped numeric dwell samples per profile.

At content-runtime start, the background owner restores the exact same-surface
state and projects decay at the current time before any episode may learn.
Missing current-key state means first observation and remains absent until the
first eligible episode commits. Wrong key, unknown schema/version, malformed
state, stale epoch, and exhausted CAS conflicts fail loudly. There is no legacy
key, migration, read-through, `chrome.storage`, `window.localStorage`, or
session-memory fallback.

The Runtime Debugger exposes only content-free summaries, retention/censoring
provenance, the fixed numeric histogram, and checkpoint health; raw retained
samples and the profile epoch do not cross that diagnostic boundary.
Persistence remains `observe_only`: it creates continuity for shadow
measurement but is not a detector, admission, presentation, or actuation input.

The same projection separates incremental tempo work from FeedFlow discovery
cost. It retains only synchronous operation/finalization counts and aggregate
total/average/maximum milliseconds. It does not add a DOM observer or candidate
scan and does not treat diagnostic timing as public-lane shipping proof.

The shadow evaluation is not consumed by `FeedFlowJudge`,
`resolveDopamineBingeDetection`, `resolveEnsoFeedEpisodeAdmission`, or
Terminus. Moving it into any of those decisions is a separate product and
architecture change with explicit caps and real-site evidence.

### Rolling pressure and rhythm

Rolling pressure intentionally applies age weights, so it is labeled
`recent_trajectory`. It is useful for prioritization and presentation but must
not be passed off as the user's robust normal distribution.

`buildRollingPressureReadModel()` is the sole producer for the Status/Home
activity-day trajectory. Its per-domain `recentTrajectory` DTO carries the
exact version, `role=recent_trajectory`, `grain=day`, provenance, completed-day
window, `excludeCurrent=true`, and sparse/forming/stable evidence state. Version
2 also carries the exact completed-day observation slots: activity date, age,
observation flag, nullable active time, and weight for every age from yesterday
through day seven. The pressure ranking keeps its existing current-plus-recent
weighted window, while the comparison reference uses those seven previous
completed activity periods. The completed-period weight schedule is
recency-relative: yesterday receives the first weight, not the current period's
pressure weight.

Source-date coverage and `stats-domain-collection-observation-v1` make missing
periods explicit at different scopes. A date-level observation cannot turn an
absent domain into zero. The per-domain collection observation owns the
trajectory slot: an observed domain row with `activeMs=0` remains a meaningful
zero in the weighted daily average, while a missing domain observation is
excluded from the denominator. Activity-day window projections scope that
observation to the selected hours instead of borrowing provenance from activity
outside the window. A zero reference stays `reference.state=zero`, while no
reference stays `reference.state=missing`. The current slot separately carries
`observed`; an unobserved current day has `activeMs=null` and
`comparison.state=current_missing`, with null delta and ratio. It is never
coerced to an observed zero. Candidate compatibility scalars, Home scan copy,
and AI narration are projections of this DTO and may not rebuild an average,
ratio, or dispersion from status date keys or today's scalar usage.
Missing compatibility scalars remain `null`; only consumer scoring internals
may map that absence to a named neutral contribution. An observed zero remains
the numeric value `0` with its `reference.state=zero` provenance.

The rolling owner accepts only explicit activity-period identity: canonical
date, age, basis, current flag, reset-hour range, source observation flag, and
`activeMs`. It rejects duplicate or future/inconsistent periods and does not
infer identity by array position or read predecessor `totalMs` aliases. The
candidate boundary revalidates exact slot identity, then re-derives the window,
status, observation counts, weight sum, weighted mean, weighted mean absolute
deviation, relative dispersion, and comparison from the raw observations before
projecting scalars. Transported summaries cannot become a second source of
truth by merely remaining internally plausible.

Cycle/wake inference is a circular, multi-hour rhythm profile with reliability
and an independently gated recommendation. Treating it as a scalar personal
baseline would erase the temporal structure and mix description with the reset
policy decision.

### Basic protection recommendation

`buildBasicProtectionRecentUsageTrajectory()` is the only Basic completed-day
trajectory adapter. It reads exactly the previous seven local calendar days and
excludes the current partial day. A missing stats date is
`observed=false, activeMs=null`; a present date without the domain is
`observed=true, activeMs=0`. The average denominator contains observed days
only and is `null` when none exist. A malformed day, domains map, numeric active
fact, clock, threshold, DTO field, or relation fails loudly.

The exact `basic-protection-recent-trajectory-v1` DTO declares
`role=recent_trajectory`, `grain=day`, provenance, window, status, evidence,
average, and all seven observations. Status is sparse at 0-2 observed days,
forming at 3-6, and stable at seven. The current partial usage is a separate
recommendation input and never changes completed-day evidence.

`buildBasicTargetRecommendation()` produces the exact
`basic-target-recommendation-v2` `adaptive_reference`. Its source names
`recent_usage_trajectory`, `current_partial_day`, or the 30-minute
`normative_default`; it always carries
`normativeDefaultSource=normative_default`, `requiresUserReview=true`, and
`autoApply=false`. Non-normative candidates are capped by the named
`maxRecommendedTargetMinutes=180`. The exact DTO carries
`recentUsageAverageDailyMs`, `currentPartialDayMinutes`, its uncapped candidate,
and `capApplied`. The contract re-derives source, mode, uncapped, and capped
values from those inputs, while the strategy and snapshot boundaries bind the
transported recent average back to the exact recent-usage trajectory. The
configured site goal remains the `normative_anchor` and settings write
authority.

Active Basic runtime has one lifecycle phase, `stabilize`, and one effective
target relation: `effectiveTargetMinutes = declaredTargetMinutes` with
`effectiveTargetSource=declared_target`. Retired acclimation, convergence, and
target-blending policies are not alternate reads or fallbacks. The strategy
contract and snapshot bridge carry the exact trajectory and recommendation so
consumers do not reconstruct them from summary scalars.

Sites/recovery URLs retain navigation state only (`tab`, selected `domain`, and
`reviewGoal` intent). They never transport declared or recommended target
minutes. The selected Rules site refreshes the runtime snapshot and derives its
CTA only from the validated `targetRecommendation`; absent DTO means absent
recommendation. URL query parsing is not a recommendation fact adapter or
fallback owner.

## Storage And Source Of Truth

| Profile family | Canonical facts/settings | Profile persistence policy |
| --- | --- | --- |
| Site Pull | stats facts/read-model series and current site facts | computed projection; do not persist a second metric authority |
| Usage baseline | stats date/domain active-time facts; goals remain settings-owned | computed projection; score decisions do not write back |
| Basic protection recent usage | exact stats date/domain active-time facts through the Basic completed-day adapter; site goal remains settings-owned | computed exact trajectory and review-only recommendation DTOs; no materialized baseline row and no automatic goal write |
| Rolling pressure | stats period projections | computed read model |
| Sites HUD weekly average | explicit calendar-day protected-exposure projection | computed read-only presentation marker |
| Cycle rhythm | stats facts plus cycle policy state | recommendation/cycle state follows its typed owner; no generic baseline record |
| CLSE | completed high-resolution CLSE buckets | materialized only in IndexedDB `clse_baseline` through `ClseRepository` / `ClseStore` and the exact storage contract |
| Feed tempo persisted shadow | content-local confirmed paged advances and lifecycle boundaries; background typed checkpoint update | epoch-fenced `model_state.feed_tempo_adaptive_profile_checkpoint_v1`; online-learning continuity only, no fixed baseline and no alternate storage fallback |

CLSE is the active materialized personal-profile family. The retained Feed Tempo
research checkpoint has a separate record and lifecycle; production FeedFlow no
longer feeds that learner. CLSE is a streaming online
model whose stored record carries version, policy, role, direction,
`reset_epoch`, timestamps, and exact-grain evidence/feature stats.
Status and confidence are freshness-sensitive read projections and are never
persisted beside their inputs. Explicit reset creates a new empty record and
epoch and atomically clears diagnostics whose decisions belonged to the
replaced epoch. A missing record is first-run bootstrap; malformed or
version-mismatched state is an error, not a reason to reinterpret an older
shape. There is no baseline-only delete API: every replacement goes through the
serialized, epoch-checked atomic reset owner.

Snapshot portability preserves the same materialized contract. Preflight
allows at most one CLSE baseline row, rejects aggression logs without it, and
requires every log to name the exact imported reset epoch before IndexedDB is
opened. Export reads the bundle inside the repository epoch lane and applies the
same preflight. A normal baseline-only reset stops collection, drains writes,
reloads canonical storage into manager memory, and recreates detectors before
resuming. Profile reset/import instead closes the old worker terminally: it
drains admitted writes, flushes the epoch lane, performs the durable mutation,
and discards manager memory without reload or resume. A missing imported
baseline becomes a canonical first-run empty row when the new runtime owns the
generation.

Feed tempo portability follows the `model_state` profile generation instead.
Export includes the exact checkpoint entry. Replace and merge import validate
the current schema before backend mutation and rebase both imported and retained
checkpoint values to the destination `profileEpoch`. A mismatched installed
epoch, malformed value, or unknown schema fails; import does not reinterpret,
drop, or recover the row through a legacy shape.

No profile may become a mirror source for canonical stats facts, goal settings,
or another domain's baseline. UI/debug state and `window.localStorage` are not
business-data authorities.

## Failure Policy

- Reject malformed descriptors, observations, profiles, versions, and unknown
  enum values at the owning boundary.
- Missing completed-day history yields a sparse profile or explicit
  `normative_only` decision; it does not trigger another-series read.
- Missing denominator/exposure yields an ineligible observation; it does not
  become zero through `||` or `??` defaulting.
- Missing CLSE materialized state is accepted only as named first-run bootstrap.
  Corrupt persisted state, cross-grain requests, and comparisons before the
  profile is ready fail with diagnosable errors.
- CLSE snapshot epoch mismatch and orphan diagnostics are named fatal errors.
  Normal explicit baseline-reset reload/resume failures remain named fatal
  errors. Profile reset/import has no old-worker recovery branch: terminal
  quiesce, mutation, or final flush failures remain explicit and the profile
  coordinator does not acknowledge runtime handoff.
- Detection/scoring failures must not mutate the observed baseline to make the
  next read succeed.
- Feed tempo candidate/exposed intervention episodes and censored trailing
  dwell must not enter its observed profile; malformed episode or diagnostic
  contracts fail instead of exporting arbitrary fields.
- A new fallback requires an Active architecture exception naming owner,
  signal, and exit condition. None is defined for the baseline families above.

## Adding A Personal Baseline Consumer

1. Name the metric, scope, unit, direction, exact grain, exposure, and canonical
   fact owner.
2. Decide whether the output is an `observed_baseline`, `recent_trajectory`,
   `adaptive_reference`, `normative_anchor`, or a different structured profile.
3. Define missing, zero, and ineligible observations before choosing math.
4. Reuse `src/domains/stats/baseline/index.js` for robust daily metric profiles.
   If the data is streaming/online, name the materialized owner and strict
   storage contract instead of cloning the daily builder.
5. Keep the consumer decision in a separate domain seam with explicit caps and
   sparse behavior.
6. Update this map, focused tests, and
   `npm run check:personal-baseline:architecture` in the same change.

## Verification

- `npm run check:personal-baseline:architecture`
- `npm run check:site-pull-pattern:architecture`
- `npm run check:friction-runtime:architecture`
- `npm run check:storage:architecture-boundaries` after CLSE persistence changes
- `npm run test:file -- tests/feedTempoEpisodeAssembler.test.js tests/feedTempoProfileLearner.test.js tests/runtimeDebuggerFeedProbe.test.js`
- focused stats/CLSE tests named by the owning boundary maps

`check:personal-baseline:architecture` is a prebuild structural guard. It keeps
the shared vocabulary, public builder seam, domain classifications, CLSE
same-grain ordering, feed-tempo compare-before-observe and shadow-only
boundaries, score caps, non-personalized Dopamine boundary, and this owner map
aligned.

## Site Intel current-sample alignment (2026-09-14)

Selected FULL Intel now supplies the current calendar-day sample to the
completed 30-calendar-day baseline and recentTrajectory. A pre-reset activity
day spanning midnight is not used as the current baseline sample. Behavior
facts, current intervention evidence, and current transition evidence share that
calendar basis. Activity-day protected charging is independently declared in
`goalContext`, including the completed seven activity-day policy denominator.
No UI or baseline consumer may take the maximum of these differently based totals.

`sitesCompletedActivityDays.js` owns the completed activity-day window used by
global averages and the selected-site policy context. The personal-baseline
architecture guard follows this delegated owner rather than requiring the
window algorithm to be duplicated in its caller. Baseline status, anomaly,
recentTrajectory and adaptive-reference public validation remain unchanged.
Final Site Pull classifications, interpretation, and diagnostic scores are not
baseline samples; the insights dependency guard and source-admission contract
protect that direction.

Site Pull SessionDepth v2 reads sample depth from the `max_session_ms` metric
and bounds its confidence by the duration and session-count metrics. Evidence
separates empirical `stats.p75`/`stats.p90` from floor-adjusted
`stats.p75Reference`/`stats.p90Reference`. The anomaly algorithm continues to use
its canonical guarded reference; descriptive ratios with a zero empirical
denominator are unavailable. Existing flat baseline DTO reference aliases and
their strict public projection remain unchanged. No UI or downstream evidence
profile may reconstruct or write a personal baseline from these outputs.

Site Pull context correction (2026-09-15) leaves the baseline owner and DTO
unchanged. TrendPressure v3 requires all seven comparison slots before a visible
trend, retains the canonical single-day-spike veto regardless of personal-score
strength, and caps output confidence by `recentTrajectory.confidence`. Habit
consumes observed daily coverage, not pooled hourly peaks as daily recurrence.
Immersion and SustainedBlock do not consume baseline anomalies as evidence of
intent or focus quality. These are downstream claim constraints, not new
baseline computations or feedback into baseline state.
