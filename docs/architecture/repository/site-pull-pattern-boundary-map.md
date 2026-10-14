# Site Pull Pattern Boundary Map

- Status: Active
- Owner: stats domain / site-pull insights
- Last validated against code: 2026-10-07
- Path policy: current-only
- Canonical for: site-pull facts, evidence profiles, pattern detection, calibration, presentation, and proxy/fallback classification
- Companion to:
  - `docs/domains/stats/stats-engine-baseline.md`
  - `docs/product/dashboard/site-pull-atomic-pattern-audit.md`
  - `docs/architecture/repository/storage-stats-tracking-boundary-map.md`

## Purpose

Site-pull is an interpretation engine, not a storage owner. It must not repair
missing facts by reading another source, reconstructing legacy shapes, or
turning low-coverage evidence into a confident habit claim.

This map exists so changes can be followed from system level down to functions:

```text
durable stats facts / current policy projection
  -> reusable site feature vector
  -> site-pull facts DTO
  -> evidence profiles
  -> detector candidates
  -> requirement validation
  -> calibration validation
  -> composite composition
  -> presentation suppression / feedback surfaces
  -> dashboard read-only consumers
```

## Owner Table

| Concern | Owner | Key files | Output | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Feature input | stats feature projection | `features/buildSiteFeatureVector.js` | local feature vector | site-pull direct storage/runtime reads |
| Facts DTO | site-pull facts builder | `buildSitePullFacts.js`, `sitePullFactSummaries.js` | `facts` with data coverage | detector-specific fact rebuilding |
| Baseline source | Rules selected-site detail query/read model plus strict source normalizer | `statsSitesSiteDetailQueryService.js`, `statsSitesSiteDetailReadModel.js`, `statsSiteIntelReadModelHelpers.js`, `baselineSeriesSource.js` | current date plus exact 30 completed-day observations, with missing markers preserved | substituting weekly history, guessing current from the last entry, or coercing missing to zero |
| Weekly observation state | shared weekly observation contract | `insights/contracts/weeklyObservationContract.js`, feature/facts builders | explicit observed-entry count and observed-only evidence denominators | treating placeholder length or missing zero as observed evidence |
| Personal baseline evidence | site-pull adapter over stats baseline core | producer `personalBaseline.js`; strict read/projection `personalBaselinePublicContract.js`; `personalBaselineMetrics.js`, `src/domains/stats/baseline/personalBaselineCore.js` | canonical metric profiles, recent trajectory, adaptive reference | treating sparse baseline as normal evidence or trusting unvalidated DTO semantics |
| Current temporal facts | site-pull temporal evidence helper | `temporalEvidence.js` | today context plus reentry, residency, tab, navigation, and cycle profiles | rebuilding a baseline or prior-vs-recent direction window |
| Recent trajectory | site-pull personal-baseline policy | `personalBaselinePolicy.js` | one `recentTrajectory` plus read-only flat/UI projections | feature, metric, temporal, or UI layers recomputing prior-vs-recent trend |
| Primitive evidence | evidence profile modules | `patterns/*EvidenceProfile.js` | `absent/observed/weak/candidate/strong` | detector-only thresholds with no profile status |
| Content-flow observation lineage | shared observation projection | `sitePullContentFlowObservations.js` | admitted observational fields and one `feed_progression` family | detector pressure/interrupt decisions as observation evidence; supply/skim/scroll aliases as independent corroboration |
| Atomic candidates | detector modules | `patterns/detectors/*.js` | candidate pattern signals | emitting composite IDs or rebuilding evidence profiles from detectors |
| Requirements | pattern requirement registry | `sitePullPatternRequirements.js` | accepted/rejected signals | data-family gates reading feature-vector shape |
| Calibration | calibration specs/audits | `sitePullPatternCalibration*.js` | visibility, confidence, score meaning, feedback-role visibility policy | unlabeled detector scores or shadow labels promoted to user feedback |
| Decision quality | pattern decision-quality projection | `sitePullPatternDecisionQuality.js` | heuristic evidence quality, boundary proximity, sample depth, corroborating-family inventory, and caveats | presenting detector confidence as a probability or counting aliases as independent support |
| Threshold inventory | threshold audit matrix | `sitePullPatternThresholdAudit.js` | threshold rows, presentation policy rows, and review queues | untracked hard cuts, bucket boundaries, or non-badge feedback gates |
| Composition | pattern composer | `sitePullPatternComposer.js` | explicit same-day dimension summaries or single-family intensity summaries; independent claims require independent evidence | detectors creating composite claims or counting multiple aliases from one primitive as corroboration |
| Aggregate analysis | aggregate pattern analysis | `sitePullAggregateAnalysis.js` | protected-set aggregate patterns | raw intel fallback when `sitePullFacts` is missing |
| Presentation | presenter / feedback surfaces | `sitePullPatternPresenter.js`, `sitePullFeedbackSurfacePresenter.js` | bounded badge/detail/recap/diagnostic items with one badge claim per recommendation family | showing proxy/shadow evidence as primary claims or flooding badges with action-equivalent labels |
| Intel reading | terminal interpretation and evidence readout | `sitePullInterpretation.js`, `sitePullInterpretationEvidence.js` | one headline message ID, typed metrics, periods, provenance, up to two primary evidence IDs and ordered disclosure IDs | UI selecting fields, summing aliases, translating missing into zero, or returning this output upstream |
| Completed-day pattern reading | selected-detail stats query | `statsSiteLongTermPatterns.js`, `siteLongTermPatternContract.js`, `statsSiteIntelReadModel.js` | `longTermPatterns`: one model-selected repeated pattern and matching 30-day hourly evidence | today-only claims, pooled-session claims without repeated days, UI reclassification, or inventing individual session intervals |
| Today-note reading | selected-detail stats query terminal producer | `statsSiteTodayNotes.js`, `siteTodayNotesContract.js`, `statsSiteIntelReadModel.js` | `todayNotes`: v1 calendar-day facts, ordered subset, FULL only; SUMMARY/ANALYSIS explicitly unloaded | activity-day substitution, exit-return/cohort claims from coarse counters, UI family/window selection, or output returning upstream |

### Completed-day pattern reading (2026-10-04)

The Zen notebook's default pattern consumes `intel.longTermPatterns`, independently
of the current/weekly terminal interpretation. The full selected-detail producer
uses exactly the 30 completed calendar dates before today from the existing
baseline owner. Analysis-tier entries publish an explicit `detail_not_loaded`
shape; they do not classify from the registry or borrow weekly evidence.

Admission requires at least seven observed dates, four active dates, and a pattern
on at least three dates and half the active dates. Short-session repetition uses
the existing measured daily criteria (at least six sessions, four shorter than
two minutes, and a short-session share of at least 0.55). Long-session repetition
uses measured sessions of at least 20 minutes. Recurring time delegates to the
existing completed-day recurrence owner, including its dominant-day guard.
These are descriptive product heuristics, not validated clinical thresholds,
probabilities, judgments of intention or risk. The producer selects a primary
pattern; the UI formats it without choosing a second priority.

Hourly evidence retains active-day counts and short/long-session occurrence-day
counts on the same period, plus measured counts and mean active duration per
observed date. A session belongs to its recorded ending hour; these counters do
not establish a start time, an individual interval or a visit sequence. Missing
session families and mismatched day/hour totals fail explicitly. Missing dates,
observed zero, insufficient history and enough history without an admitted
pattern remain separate states. Recorded dates do not promise continuous coverage.
This seam adds no storage, collection, policy mutation or feedback input owner.

The `sites-site-long-term-patterns-v2` query contract also publishes each observed
day's `hourlyActiveMs` (24 millisecond values, summing to that day's `activeMs`);
unobserved days publish `null`. When an admitted `recurring_time` pattern exists,
observed days publish `recurringWindow` with its circular-window active-time sum
and daily share, using the same calculation as the producer's admission check.
Observed zero-use days publish `{ activeMs: 0, share: null }` because the share's
denominator is zero. Unobserved days, and all days without that pattern, publish
`recurringWindow: null`. The public contract validates these relations without
selecting or reclassifying patterns. The unloaded contract retains empty day and
hour arrays at version v2; no historical storage migration is involved.

### Today-note reading (2026-10-11)

`buildSitesSiteTodayNotes()` publishes terminal `intel.todayNotes` at
`sites-site-today-notes-v1`, basis `local-calendar-day-hour`, on FULL selected detail.
SUMMARY/ANALYSIS use `detail_not_loaded` with a null date and no notes. Loaded missing
observation and observed zero retain distinct `missing`/`observed` states, even though
both have empty notes. Each `{ id, value, denominator, unit, source, window?, responses? }`
is a unique ordered subset of short sessions → peak time window → visit-start interval
→ friction response; positive denominators admit families, while zero numerators stay
measured zero. The producer chooses the busiest same-date adjacent two hours (starts
0–22, no 23+0 wrap, earliest tie), validates their millisecond sum against calendar-day
`todayTotal`, and never reads the activity-day usage total. Short-session counts come
from completed sessions; their full duration can exceed that date's active-time total.
`revisitWithin5m` is previous visit start → next visit start within five minutes,
including background-tab visits, not exit → return. Friction shown/continued/left are
independent event-date counts, not a cohort, partition or share: responses may exceed
shows, and zero shows with positive responses are valid but omit the friction note.
Invalid sources/contracts fail explicitly. This seam adds no collection, storage,
settings or historical pattern threshold/order change, and must not feed back into
features, facts, baseline or classification.

## Function Path Map

| Stage | Function | Responsibility | Failure / missing-data policy |
| --- | --- | --- | --- |
| Profile entry | `computeSitePullProfile()` | validates the canonical personal-baseline projection before feature reconstruction, then orchestrates scoring, patterns, and feedback over the validated facts | no storage fallback; supplied facts must already contain canonical `personalBaseline` and `temporalEvidence`, and neither is silently rebuilt |
| Facts | `buildSitePullFacts()` | normalizes usage, goal, entry, session, behavior, navigation, transition, intervention facts | requires intel/vector plus the explicit baseline source pair; missing or malformed source fails, while `baselineSeries=[]` is the named sparse source |
| Temporal evidence | `buildSitePullTemporalEvidence()` | derives today context and current reentry, residency, tab, navigation, and cycle-position profiles from a named source mode | `fact_draft` may read today's source vector families while facts are assembled; neither mode accepts personal baseline input or computes prior-vs-recent direction |
| Navigation intent metrics | `buildSitePullNavigationIntentMetrics()` | derives direct-entry/reload intent from `facts.navigation`, with visit denominator from `facts.entry` | missing navigation facts stay unavailable; explicit invalid navigation/entry facts fail and must not be repaired from feature-vector shape |
| Immersion navigation continuity | `buildSitePullImmersionEvidenceProfile()` | derives navigation-continuity support from `facts.navigation` | missing navigation facts become a caveat; explicit invalid navigation facts fail and must not be repaired from raw vector stats |
| Checking entry evidence | `buildSitePullCheckingEvidenceProfile()` | derives checking-loop, visit-spread, switch-churn denominators, navigation, and tab-context evidence from owned facts families | entry/visit denominators must not be repaired from feature-vector shape; session hourly proxy is the bounded exception |
| Session evidence shape | `resolveSitePullSessionShape()` over `resolveSitePullSessionFacts()` | one current measured/estimated projection from `facts.session` for Checking, SustainedBlock, ControlledBrief and Immersion | selects the declared source mode before values; measured zero never borrows estimates, weekly sessions never prove a session today, and hourly totals never become a strict maximum; explicit invalid families/scalars fail |
| Data coverage read model | `buildDataCoverage()` | projects `facts.dataCoverage` with confidence parts for profile output | missing or invalid coverage DTO fails; profile output must not rebuild coverage from feature vectors/options |
| Public facts | `toPublicSitePullFacts()` | validates and projects the same canonical facts used internally; no private vector cache exists | invalid input fails with `SITE_PULL_FACTS_PUBLIC_INPUT_INVALID`; redundant cache fails with `SITE_PULL_FACTS_REDUNDANT_FEATURE_VECTOR` |
| Evidence status | `buildSitePullCheckingEvidenceProfile()` and siblings | turns facts into primitive evidence status | weak/observed evidence stays diagnostic until candidate |
| Detector candidates | `detect*Patterns()` | emits atomic candidates only | missing facts should skip or emit a named proxy/state, never silently substitute |
| Layers | `buildSitePullPatternLayers()` | annotates, dedupes, validates, calibrates, composes | rejected patterns remain diagnosable |
| Requirements | `validateSitePullPatternSignals()` | accepts or rejects candidates from source, evidence, and facts availability | `*Facts` gates must read facts coverage/facts DTOs, not feature-vector shape |
| Decision quality | `buildSitePullPatternDecisionQuality()` | separates heuristic evidence quality from detector intensity and records sample strength, boundary margin, corroborating families, and caveats | this is not a probability and must not repair missing facts or override requirement failures |
| Diagnostics | `buildSitePullPatternDiagnosticReport()` | explains data-family availability and skipped pattern families from facts coverage | diagnostics must not rebuild missing coverage from feature-vector shape |
| Aggregate analysis | `buildSitePullAggregateAnalysis()` | computes protected-set aggregate patterns from per-domain public facts | missing facts stay missing; invalid facts fail with `SITE_PULL_AGGREGATE_FACTS_INVALID`; domain profile/presentation output is not an input authority |
| Presenter | `presentSitePullPatterns()` | applies state exclusivity, shadow/supporting visibility, semantic dominance, group limits, recommendation-family burden, and the badge-surface cap | presentation suppression is not data repair |

## Proxy And Fallback Policy

### Foundation model contract (2026-09-14)

The model is `site-pull-release-v5`. TimePressure, SessionDepth and Checking retain
v2 foundation profiles (Checking v3 delegates tab primitives). SustainedBlock, ControlledBrief and Immersion use v3;
HabitConsistency, NightPressure and BackgroundResidency use v2; TrendPressure
uses v3. These are rule-based descriptive estimates, not probabilities
or a validated harm score. Storage, collection and classification input direction
remain unchanged; outputs never become observations or baseline samples.

- TimePressure describes current calendar-day volume and personal change. It
  never reads the goal or increases confidence for having one. Goal comparison
  stays in `goalContext`/plan friction. Weekly ratios use the current-inclusive
  observed calendar-day window and are `null` below the five-minute reference
  floor; the completed 30-day personal reference remains a separate basis.
  Missing ratios are omitted by the formatter, never displayed as zero or 2x.
  All time-volume channels share the `active_usage` evidence family.
- `sitePullSessionFactSource.js` owns the current-session projection. A missing
  family stays unavailable; sparse summary scalars are zero projections within
  the explicitly declared source mode. A supplied invalid family or negative,
  non-finite or non-number scalar fails. Selecting measured mode prohibits
  borrowing a positive estimate. A weekly measured flag with zero current count
  cannot establish a current measured session. Estimated hourly counts retain
  `hourly_proxy` identity and have no strict session maximum or long-session count.
- SustainedBlock duration is the measured session maximum. `max3hTodayMs` and
  `focusShare` describe hourly concentration separately; neither establishes
  continuity. An atomic focused block requires a measured current session,
  at least 25 minutes total, a 20-minute strict maximum and 55% strict block share.
  Hourly-only facts cannot emit it. Immersion consumes the same strict block
  duration and cannot reconstruct it from hourly concentration. Goal edits do
  not change the SustainedBlock profile.
- SessionDepth takes sample counts from `max_session_ms`, and confidence is
  bounded by both maximum-duration and session-count metric confidence.
  Its v2 evidence `maxSessionP75Ms`/`maxSessionP90Ms` are observed percentiles;
  `maxSessionReferenceMs`/`maxSessionP90ReferenceMs` are guarded decision references.
  `todayVsMaxSessionReferenceRatio` is the canonical anomaly ratio. The observed
  percentile ratio and long-session-rate lift are `null` when their empirical
  denominator is zero. The existing flat personal-baseline DTO is unchanged;
  its historical P75 aliases still project guarded references and are not inputs
  to this profile. Multiple depth channels share `session_duration` lineage.
- Checking combines overlapping visit-return, switch-return and route-return
  projections with a weighted maximum, including personal anomaly projections;
  it removes the multiplicative return-alias bonus. This is a conservative
  overlap bound, not exact event deduplication. Return ratios are gated by counts
  1–4 and short-session ratios by measured counts 2–6. A personal quick-return
  anomaly still needs at least three current switches/two returns (candidate),
  five/four (strong), and two/one for composite support. An explicit current zero
  is not replaced by a conflicting baseline projection.
- Session fragmentation needs current measured counts for candidate/composite
  support. A baseline anomaly alone remains diagnostic. Observed visit total zero
  remains zero even if an hourly shape contains positive counts. Existing coarse
  switch-counter admission remains named and bounded; no new fallback is added.

The threshold audit records these gates and overlap rules. Regression fixtures
cover goal-only edits, hourly fragmentation versus one long session, current
zero with prior sessions, sparse/zero references, small denominators and aliases.
The context contract below limits valence and temporal co-occurrence claims.
The event/cohort contract below constrains composition. Stronger intensity alone
is not proof of harm or unwanted intent.

### Context model contract (2026-09-15)

The existing pattern IDs remain transport/consumer identifiers. In particular,
`controlled_brief_check`, `focused_block`, `deep_immersion` and `late_night_binge`
do not license control-success, attention-quality, unwanted-absorption or sleep
claims. Detectors, definitions, feedback roles and translated copy describe
observations with neutral valence. No collection, storage key or baseline DTO
change is involved. The model-version change invalidates versioned diagnostics.

- ControlledBrief requires current measured sessions: 2–12 minutes total,
  1–3 visits/sessions, positive measured average and maximum at most 5 minutes.
  Quiet/missing behavior, goal fit and low pressure cannot establish control.
  Same-day returns may coexist with brevity. Neither session completion nor
  intentional exit is observed. The feedback role is descriptive, without a
  maintain-action recommendation.
- SustainedBlock strength is the measured block shape alone. Switching context
  may be disclosed but cannot upgrade/downgrade the same duration into good
  focus or bad immersion. Immersion requires the same measured long session and
  same-day movement or returns. Feed projections and return projections use
  weighted maxima within their overlapping families. Day totals do not locate
  movement/returns inside that session; `temporalAssociation` says
  `day_level_cooccurrence`. Continued interventions, absent exits, goal overrun,
  night context and duration anomaly alone cannot supply absorption support.
- Habit uses daily presence, streak, volume and visits. At least five observed
  calendar slots and four active days are required. Pooled hourly concentration
  is diagnostic only: it cannot establish repeated time-of-day behavior. Current
  checking and goal pressure cannot classify a weekly habit's valence.
- Night reads the fixed clock window, not a personal sleep window. Duration
  context uses night-window minutes only. The weekly hourly total divided by
  observed calendar days is a current-inclusive reference; below five minutes
  or without a reference the comparison ratio is null. Pooled weekly hours
  cannot establish repeated nights (`recurringNightDays: null`). Missing hourly
  data remains unavailable, supplied malformed arrays fail, and nullable cycle
  positions remain null. The historic composite is one window's intensity
  promotion, not independent corroboration of a binge.
- Background reads `facts.behavior` only. Time and intensity use channel maxima,
  never a sum of overlapping media/linger/stale channels. Even the maximum is
  accumulated tab time, not unique elapsed time or attention. A weekly total
  alone yields `weekly_background_observed`; recurrence needs at least three
  observed daily behavior records with a channel maximum of five minutes.
  `evidenceWindow` owns today/weekly formatting. A zero active denominator yields
  a null ratio. UI presents separate channel quantities, not an attention total.
- Trend consumes canonical `recentTrajectory`. A complete seven-slot comparison
  is required. `singleDaySpikeScore >= 0.62` vetoes rising labels even with a
  strong personal trend score; confidence cannot exceed trajectory confidence.
  Increased usage is descriptive, not a negative behavioral verdict.

`tests/sitePullContextModels.test.js` protects these counterexamples through raw
facts and the engine. The architecture guard prevents goal/valence shortcuts,
temporal-output fallback for background, and baseline-only support for a long
session. The existing output-to-input and storage dependency guards remain in
force. No classifier writes observations, features or baseline samples.

Use these words consistently:

| Class | Allowed? | Rule |
| --- | --- | --- |
| Missing-data state | Yes | `no_activity`, `insufficient_data`, and bounded `steady` states must name why no stronger claim survived |
| Proxy evidence | Yes, bounded | Must carry proxy identity/caveat, lower confidence or supporting/shadow visibility, and no direct concrete claim |
| Coarse counter evidence | Yes | Must identify compression or missing bucket shape; do not call it legacy fallback |
| Personal baseline evidence | Yes | Must expose source and confidence; baseline-only evidence must not masquerade as behavior-backed evidence |
| Legacy runtime fallback | No | Do not reintroduce alternate legacy fact reads or normal-runtime compatibility paths |
| Silent empty repair | No | Missing facts must not become successful empty patterns without a named data-quality state |

Current bounded proxy/state contracts:

- Content-flow interpretation admits observations through
  `resolveSitePullContentFlowObservations()`. Feed pressure/interrupt counters
  remain in historical diagnostic storage and are omitted from analysis facts; they do not establish
  behavioral coverage, enter scores/evidence/caveats, alter presentation tone, or
  corroborate another behavioral judgment. This applies to checking score,
  immersion continuity, content-flow profiles, and contribution explanations.
  An explicit observation-availability marker may still describe observed zero;
  detector counters alone may not manufacture that marker.
- Supply, skim, and scroll-velocity projections can describe the same physical
  feed progression. They have one `feed_progression` lineage. The v3 content-flow
  profile takes their maximum descriptive intensity, without additive
  corroboration/synergy bonuses. Checking v3 also uses the maximum weighted
  content-flow projection. Immersion v3 also uses weighted maxima for the
  admitted feed family and for overlapping same-day return projections. These
  terms do not establish within-session sequence or independent event counts.
- `feed_loop_pattern` requires at least two independent evidence families, and
  the current content-flow projection supplies at most one. It therefore cannot
  emit that composite, including with saturated supply or recorded media
  attention. Skim/scroll remain supporting diagnostics. Adding a valid second
  family and validating the behavioral model is separate product/model work;
  increasing counters or adding another alias does not reopen the label.
- Actual responses to interventions (continue, leave, and timed reentry relative
  to an eligible presentation) remain observed outcomes for the intervention
  response family. A detector deciding to intervene is not such an outcome.

- `checking_pattern_proxy` is a supporting proxy when entry/visit facts are
  unavailable but hourly facts can explain checking-loop shape.
- `steady` is a collector-owned fallback state only when detector output is
  empty and the final pattern set has no stronger claim.
- `quick_return_loop` may use compressed re-entry buckets when available.
  Without bucket shape it may use the current coarse switch-back counter, but
  the evidence must name `coarse_switch_back_counter` and
  `impulseCoarseSwitchBackScore`, not a legacy fallback.
- Baseline-backed `quick_return_loop` and `switch_churn_loop` must keep
  `source=personal_baseline`; behavior-backed route evidence must expose
  behavior candidate flags.
- Personal baseline is descriptive self-history, not a goal and not a repair
  source. `baselineSeries` and `baselineCurrentDateStr` are both required.
  Explicit `baselineSeries=[]` is the sparse source. A non-empty series is
  exactly 30 ascending completed calendar days immediately before the declared
  current date. `weeklySeries` never derives or repairs it, and the last source
  entry never supplies an inferred current date. Explicit `todayVisits` and
  measured session counts must not be repaired from hourly visit shape.
- Baseline source observations preserve provenance: observed zero is
  `observed=true, activeMs=0`; missing is
  `observed=false, activeMs=null`. The Rules selected-site owner requests 31
  calendar days including current, then projects the completed 30-day baseline
  and weekly/current series separately from their union. Repository retention
  or evidence ranges shorter than current plus 30 completed days fail loudly.
- Baseline-backed detectors, scoring, and evidence profiles read named metric
  profiles from `personalBaseline.metrics`; flat personal-baseline fields are a
  metric-derived public/profile summary projection, never an alternate input
  authority. `temporalEvidence` does not consume a personal baseline.
- Metric score projections should go through
  `resolveSitePullPersonalBaselineMetricScores()` rather than local helper
  copies or direct `personalBaseline.metrics` score rebuilds.
- `personalBaselinePublicContract.js` validates more than field presence. Known
  metric IDs must retain their canonical taxonomy, versions, provenance, and
  confidence gate. Recent-trajectory and adaptive-reference derived fields are
  re-evaluated through the shared policy derivation functions, including
  trajectory dispersion/state and adaptive `referenceMode`/tightening caps.
  Metric anomaly score, ratio, robust z, and confidence-gated anomaly score are
  re-derived from canonical current facts, metric stats/reference, and the
  metric's named anomaly options through the shared stats-core algorithm.
  Sparse `normative_only` output keeps the observed reference descriptive and
  fixes the decision reference to the named product minimum.
- `buildSitePullRecentTrajectory()` is the only Site Pull producer of
  prior-vs-recent direction, momentum/reference ratios, dispersion/volatility,
  and the current-inclusive single-day-spike guard. Its public DTO carries the
  exact comparison-day counts, active-day counts, recent total, previous recent
  maximum, current value/share, and spike score needed by consumers. Temporal
  evidence and trend-pressure presentation must not rebuild `recent3d`,
  `recent7d`, linear `weighted7d`, trend ratios, or robust trend z-scores.
  Its raw adapter slices completed calendar slots first and filters missing
  observations inside each fixed window second. It never extends a recent
  window backward to collect seven observed days.
- The owning public/policy DTO versions are `site-pull-personal-baseline-v3`
  and `site-pull-personal-baseline-policy-v3`; the current temporal-facts DTO is
  `site-pull-temporal-evidence-v2`.
- Baseline policy interpretation such as status, confidence, and personal
  weight should go through `resolveSitePullPersonalBaselinePolicyContext()`;
  sample coverage should come from the relevant metric sample.
- Site-pull profile inputs have one authority: either supplied facts, or
  intel/vector used to build facts. Supplying facts with `intel` or
  `featureVector` fails with `SITE_PULL_FACTS_INPUT_AUTHORITY_CONFLICT`;
  invalid facts fail with `SITE_PULL_FACTS_INPUT_INVALID`. Public facts
  projection rejects invalid input with `SITE_PULL_FACTS_PUBLIC_INPUT_INVALID`;
  callers that intentionally omit detail should set `sitePullFacts: null`
  explicitly rather than asking the projection to manufacture absence.
- `computeSitePullProfile()` validates `personalBaseline` through the strict
  public contract before `resolveSitePullFeatureVector()`, scoring, contribution
  building, pattern evaluation, diagnostics, or coverage reads. Those consumers
  receive a facts object whose baseline has been replaced with the validated
  projection; raw supplied anomaly or trajectory scalars never run first.
- Site-pull facts/profile entrypoints require an actual input authority:
  no-input calls fail with `SITE_PULL_FACTS_BUILD_INPUT_MISSING`, and invalid
  feature-vector input fails with `SITE_PULL_FACTS_FEATURE_VECTOR_INPUT_INVALID`.
- `buildSiteFeatureVector()` accepts the current canonical intel field names
  directly. There is no alias table or predecessor-key read-through. Derived
  weekly summaries from `weeklySeries` are allowed only when the corresponding
  current weekly summary field is absent. It does not classify or score a
  recent trajectory.
- Every `weeklySeries` entry declares `observed: boolean`. Missing state is a
  contract error; it never defaults to observed. A seven-slot missing window has
  `observedWeeklyDays=0` and `hasWeeklyFacts=false`. Seven explicit observed zero
  days have `observedWeeklyDays=7` and `hasWeeklyFacts=true`, while totals remain
  zero. Weekly average, day rates, regularity, scoring confidence, requirements,
  and diagnostics use the shared observed-entry selector rather than array
  length. The seven-slot series remains intact for streak/sequence logic, and a
  missing slot breaks continuity instead of joining observations on either side.
  Facts rebuild and public projection reject a mismatched
  `observedWeeklyDays` or weekly scalar relationship.
- The selected-detail current stats day declares `todayObserved: boolean` at
  the read-model boundary. It propagates into metric, baseline, and trajectory
  `currentObserved`. An unobserved current slot is excluded from trajectory
  comparison counts/totals and cannot become a zero-use, spike, or rebound fact.
- Each Site Pull metric represents 30 completed target slots. The public reader
  requires `observedCount + missingCount = 30` and identical observed/missing
  coverage across metric IDs. An empty analysis-tier source becomes 30 missing
  metric slots while its topology-dependent trajectory remains sample-less.
- Rebuilding a feature vector from public `sitePullFacts` and building facts
  from a supplied feature vector follow the same ownership rule. The baseline
  source pair is never derived; it must be explicit and canonical. Separately,
  the goal-only `goalMs` field may be derived when its source field is absent,
  but not when present as zero; that rule does not apply to baseline fields.
  Entry visit totals follow the same rule: hourly visit shape may derive totals
  only when `todayVisits` or `weeklyVisits` is absent.
- Temporal evidence must declare its input mode. `fact_draft` is reserved for
  `buildSitePullFacts()` while it is assembling the facts DTO from the source
  vector. Profile/runtime analysis uses `facts` mode; missing `entry`,
  `behavior`, or `navigation` families fail with
  `SITE_PULL_TEMPORAL_EVIDENCE_FACT_FAMILY_MISSING`, invalid families fail with
  `SITE_PULL_TEMPORAL_EVIDENCE_FACT_FAMILY_INVALID`, and neither path falls
  back to raw feature-vector counters. Personal baseline is not an input to this
  layer; canonical direction is joined separately through `recentTrajectory`.
- Temporal evidence metrics that need visit denominators read them from the
  resolved entry fact family. The today context uses the same entry summary;
  feature-vector visit shape may only inform the bounded cycle-position hourly
  proxy and must not repair `facts`-mode denominators.
- Navigation intent metrics read `facts.navigation` for direct-entry/reload
  counts and `facts.entry` for visit denominators. Missing navigation facts may
  produce unavailable/absent evidence states, but explicit invalid navigation
  facts fail with `SITE_PULL_NAVIGATION_INTENT_FACTS_INVALID`, explicit invalid
  entry facts fail with `SITE_PULL_NAVIGATION_INTENT_ENTRY_FACTS_INVALID`, and
  neither family may be repaired from feature-vector shape.
- Immersion navigation continuity follows the same authority: missing
  `facts.navigation` becomes `navigation_facts_unavailable`, while explicit
  invalid navigation facts fail with `SITE_PULL_IMMERSION_NAVIGATION_FACTS_INVALID`.
- Checking evidence reads visit/entry denominators from `facts.entry` and usage
  hour evidence from `facts.usage`. Checking-loop, distributed-visit,
  switch-churn, navigation, and tab-context evidence must not repair missing
  entry facts from feature-vector visit shape.
- Controlled-brief, habit-consistency, sustained-block, and night-pressure
  evidence follow the same visit authority: duration, habit shape,
  and hourly/session proxies may use their owned inputs, but visit counts,
  visit spread and visit denominators come from `facts.entry`. Tab-context
  denominators are unavailable and never borrow this visit source.
- `resolveSitePullEntryVisitSummary()` is a facts-entry helper only. Feature
  vectors may enter the system through `buildSitePullFacts()`, but downstream
  pattern, score, and context layers must not pass feature-vector visit shape
  to repair missing entry facts.
- Checking-carousel composition consumes accepted candidates and
  `checkingEvidenceProfile` visit evidence; it must not reconstruct visit
  pressure from feature-vector visit shape.
- Checking composition requires a current candidate and at least two measured
  observation dimensions: attention switching, entry distribution, measured
  session shape, or navigation entries. The compatibility field
  `corroboratingEvidenceFamilyCount` counts dimensions, not independent events.
  Route aliases add no dimension; baseline outputs cannot create current facts.
  Strength is a maximum, confidence is a conservative fixed 0.62 heuristic, and
  `compositionBasis=day_cooccurrence` explicitly excludes ordered-loop claims.
- Detector modules and composer helpers consume prebuilt evidence profiles from
  `evaluateSitePullPatternLayers()`; missing detector/composer profile inputs
  fail with `SITE_PULL_DETECTOR_EVIDENCE_PROFILE_MISSING` or
  `SITE_PULL_COMPOSER_EVIDENCE_PROFILE_MISSING` rather than rebuilding profile
  dependencies inside those consumers.
- Duplicate atomic IDs retain `sourceList` and `mergedSignalCount`, but the
  evidence-aware primary source owns the complete evidence population, score and confidence. Secondary evidence fields are not merged. A
  secondary baseline or proxy signal must not inflate a concrete current-fact
  signal through `Math.max`. Composite confidence comes from its owning profile or the bounded same-day
  summary contract; adding component labels never increases it. Dominance and
  supporting IDs require matching explicit evidence windows.
- Contribution breakdown evidence follows the same explanation boundary:
  checking-loop visit facts are projected through
  `resolveSitePullEntryVisitSummary()` from `facts.entry`, not repaired from
  feature-vector visit shape.
- Session evidence profiles read `facts.session` through
  `resolveSitePullSessionFacts()`. Missing session facts may remain absent or
  use bounded hourly shape where the profile already labels it as estimated,
  but explicit invalid session facts fail with profile-specific session error
  codes and must not be repaired from `featureVector.todaySessionStats`.
- Profile data coverage reads `facts.dataCoverage` as an owned DTO. Missing
  coverage fails with `SITE_PULL_DATA_COVERAGE_MISSING`, invalid coverage fails
  with `SITE_PULL_DATA_COVERAGE_INVALID` or
  `SITE_PULL_DATA_COVERAGE_FIELD_INVALID`, and profile output must not rebuild
  coverage from feature-vector shape or options.
- Pattern diagnostics read data-family availability from `facts.dataCoverage`
  and owned facts DTO fields. They may explain missing families, but must not
  mark a family available by reconstructing it from feature-vector shape. The
  diagnostic data-family registry is closed; unknown family ids fail with
  `SITE_PULL_PATTERN_DIAGNOSTIC_DATA_FAMILY_UNKNOWN` instead of producing an
  `unknown` availability row. When diagnostics are present, a missing status row
  for a known family fails with
  `SITE_PULL_PATTERN_DIAGNOSTIC_FAMILY_STATUS_MISSING`.
- Pattern requirements may inspect candidate evidence and detector-level
  `featureVector` state, but `*Facts` availability gates must read
  `facts.dataCoverage` or the owned facts DTO family directly. They must not
  resurrect missing usage/hourly/weekly/entry facts from feature-vector shape.
- Pattern evaluation context follows the same rule: when `facts` are supplied,
  visit availability and fallback-state visit evidence read `facts.entry` /
  `facts.dataCoverage`; the separate precomputed-feature-vector entry mode does
  not participate in that facts-owned request.
- Data/plan state detectors may read usage and goal projection from
  `featureVector`, but their visit-count evidence must use the shared entry
  visit summary so supplied `facts` cannot be repaired by vector visit fields.
- Score-model checking-loop visit scoring and confidence use the same shared
  entry summary. Precomputed-feature-vector scoring is a distinct current input
  mode and is admitted only when no facts object is supplied.
- Aggregate analysis reads per-domain `sitePullFacts`; it must not repair
  missing facts from raw intel counters. Missing per-domain facts remain
  unavailable, while invalid non-null facts fail with
  `SITE_PULL_AGGREGATE_FACTS_INVALID`. Domain `sitePullProfile` output is not
  an aggregate input authority; aggregate scoring, top domains, and temporal
  evidence must come from `sitePullFacts`. Aggregate visit denominators use the
  shared `resolveSitePullEntryVisitSummary()` helper, so hourly visit totals may
  only repair absent totals inside the owned `facts.entry` family.
- Domain feedback surfaces are a closed presentation contract:
  `badge`, `detail`, `recap`, and `diagnostic`. Unknown surface input must fail
  with `SITE_PULL_FEEDBACK_SURFACE_INVALID`, not fall back to detail limits or
  silently produce empty feedback.
- Pattern feedback policy surfaces are also closed: unknown policy input fails
  with `SITE_PULL_PATTERN_FEEDBACK_SURFACE_INVALID`, leaving
  `surface_not_allowed` only for known surfaces that a pattern does not support.
- Aggregate feedback surfaces are a closed presentation contract:
  `sites_overview`, `recap`, and `diagnostic`. Unknown surface input must fail
  with `SITE_PULL_AGGREGATE_FEEDBACK_SURFACE_INVALID`, not disappear as hidden
  feedback. Habit feedback candidate synthesis must reuse
  `requireSitePullAggregateFeedbackSurface()` rather than normalizing arbitrary
  strings to recap, but `diagnostic` is not a valid habit-candidate source
  surface. Injected domain/aggregate feedback items must match the requested
  source surface with `visible` visibility, and domain recap inputs must be
  profile rows directly rather than `{ sitePullProfile }` wrapper aliases.
- Feedback surface inventory is a closed registry for both domain and aggregate
  rows. Unknown domain surfaces fail the inventory audit with
  `unknown_domain_surface`; unknown aggregate surfaces fail with
  `unknown_aggregate_surface`.
- Pattern calibration visibility and feedback surfaces must agree. `shadow` and
  `supporting` calibration rows are supporting evidence only, must not be badge
  eligible, and must retain diagnostic visibility. Non-badge feedback rows also
  appear in the threshold audit as presentation policy rows so the review queue
  does not mistake them for missing primary labels. Calibration result summaries
  require a known result status; malformed results fail with
  `SITE_PULL_PATTERN_CALIBRATION_RESULT_STATUS_INVALID`. Calibration and
  threshold audit count summaries use `missing:<field>` buckets for absent
  fields instead of generic `unknown` buckets.
- Domain feedback items separate surface visibility from claim visibility:
  `visibility` / `surfaceVisibility` answers whether the item belongs on the
  requested surface, while `claimVisibility` distinguishes `primary_claim`,
  `supporting_evidence`, and `diagnostic_only`. Supporting evidence may appear
  in detail or recap surfaces, but it must not become a primary claim.
- Aggregate feedback items follow the same split. `sites_overview` items are
  `primary_claim`, `recap` items are `recap_context`, and `diagnostic` items
  are `diagnostic_only`, even when the surface item itself is visible.
- Habit feedback candidate synthesis must preserve that claim contract instead
  of treating every visible item as equivalent. Aggregate `recap` candidates
  require `recap_context`, aggregate `sites_overview` candidates require
  `primary_claim`, and domain `recap` candidates may only carry
  `primary_claim` or `supporting_evidence`; `diagnostic_only` inputs fail
  before candidate synthesis.
- Badge presentation has a bounded label-burden policy. After semantic
  dominance and per-group limits, only the highest-ranked claim for one
  recommendation family remains in the badge lane, and the badge surface has
  a global four-claim cap. Suppressed claims remain available to detail,
  recap, or diagnostic consumers according to their surface contract.
  Semantic rank favors the more personalized/actionable explanation inside a
  family: a kept configured goal outranks a generic brief-check success, a
  rising trajectory outranks generic daily regularity, and a corroborated
  checking composite outranks its generic checking atom.
- Pattern `confidence`, local detector `score`, and decision quality answer
  different questions. `decisionQuality.kind=heuristic_evidence_quality`
  combines detector strength and sample depth with a confidence ceiling; threshold
  headroom remains separate. Family IDs and caveats are explanatory inventories,
  not bonuses or penalties for the number of names. The exact caveat list
  remains available for explanation. It must never
  be described as a calibrated probability.
- The selected-site Rules consumer must render the contracted `detail` surface,
  not reconstruct claims from the score. `TargetBehaviorProfile.js` keeps the
  primary claim ahead of supporting evidence and projects decision quality as
  evidence level/boundary proximity; `SiteDecisionWorkspace.jsx` renders one
  primary claim by default and bounds supporting claims, evidence chips, and
  collection basis to the explicit Evidence view. It does not reconstruct
  weekly/hourly recurrence from presentation arrays, and recommendation copy
  without an owned action handler is not presented as a working control.
  Unknown pattern IDs fail at this consumer boundary instead of receiving
  `steady` copy.
- Aggregate pattern planning cost budgets are a closed execution contract:
  unknown budget input fails with `SITE_PULL_AGGREGATE_COST_BUDGET_INVALID`.
  Unknown spec cost classes fail with `SITE_PULL_AGGREGATE_COST_CLASS_INVALID`;
  neither path may silently fall back to `cheap`. Aggregate plan data-family
  gaps report absent diagnostics as `unavailable`; unknown family ids fail with
  `SITE_PULL_AGGREGATE_PLAN_DATA_FAMILY_UNKNOWN`, and malformed diagnostic
  statuses fail with `SITE_PULL_AGGREGATE_PLAN_FAMILY_STATUS_INVALID`.

## Guardrails

- `check:site-pull-pattern:architecture` is the primary structural guard.
- Detectors must not emit composite IDs directly.
- Site-pull modules must remain pure over supplied facts and must not access
  storage/runtime APIs.
- Every pattern definition must have a requirement and calibration spec.
- Every high-risk bucket/hard-cut threshold belongs in
  `sitePullPatternThresholdAudit.js`.
- Composite fusion audits must inventory independent evidence families, not
  only raw supporting-signal counts.
- The architecture guard rejects feed detector decision fields in Site Pull
  interpretation/scoring and rejects the old alias-count/strong-supply shortcut.
  `sitePullContentFlowLineage.test.js` plus the public profile invariance cases
  verify that changing detector pressure/interrupt history cannot change
  behavioral availability, score, status, confidence, evidence, or badges.
- Copy/product tuning may change visibility and wording, but must not move
  fact ownership into UI components.

## Analysis direction and terminal interpretation (2026-09-14)

The current facts version is `site-pull-facts-v2`, the diagnostic model version
is `site-pull-release-v5`, and the terminal interpretation version is
`site-pull-interpretation-v3`. These are computed DTOs; this change adds no
persistent setting, storage key, or historical schema migration.
V3 adds a nullable, validated `explanationKey` to each terminal claim. The
evidence descriptor owns its meaning; translated explanations never become
model inputs. Missing reference values select an explicit unavailable-reference
explanation, while observed zero remains a valid comparison. Time-volume copy
uses the already admitted channel to distinguish a personal comparison from a
standalone total; no detector threshold, score or primary-pattern order changes.
The product release baseline is independent of these computed model revisions.
`check-release-v1-baseline.mjs` pins the canonical model declaration to
`site-pull-release-v5`; a future model revision must update this contract and its
guard together. Unchanged calibration/presenter/feedback release contracts keep
their existing V1 checks.

| Concern | Canonical owner | Contract |
| --- | --- | --- |
| Source admission | `insights/contracts/siteAnalysisInputContract.js` | `assertSiteAnalysisSourceInput()` rejects final analysis/profile/pattern/score/interpretation fields as source input, including an explicitly null output field |
| Facts authority | `buildSitePullFacts.js` | exactly one intel/vector input, or supplied facts; facts never contain `featureVector`; internal and public facts replay through the same reconstruction |
| Observation state | `sitePullObservationState.js` | explicit `missing / observed_zero / activity`; unobserved input produces insufficient_data, null score/band, zero confidence; no-activity requires an observed source |
| Policy context | `insights/contracts/siteGoalContext.js` | validated basis, current observation and charged use, completed-period observed/active/over-limit counts; deriveSiteGoalMetrics owns goal ratios including explicit zero; requireSiteGoalMetrics rejects contradictory projections |
| Intervention response | `sitePullInterventionFacts.js` | actual responses establish observation availability; only qualifying reentry intensity enables the scoring dimension; continue/leave/Escape alone do not change weights |
| Terminal selection | `sitePullInterpretation.js` | picks one admitted measurable behavior claim or collecting/observed-zero/unclassified state, owns metric/expanded/policy references and declares diagnostic score meaning |
| UI read | shared `TargetBehaviorProfile.js` / `siteIntelVerdict.js`, Zen/shared workspaces | format the selected IDs and evidence; do not pick another primary pattern, derive evidence quality from confidence, or publish diagnostic score as behavior risk |

The dependency direction is source facts → descriptive features/baseline →
evidence profiles → candidates/calibration/composition → feedback surfaces →
terminal interpretation → UI. Reusing intermediate evidence across later layers
is allowed; importing final classification/presentation back into upstream
features, facts, baseline, or evidence is prohibited. The architecture guard
traces relative and `@/` imports/re-exports (including static literal dynamic
imports) transitively within insights, and scans the whole insights tree for
feed detector decision counters. Behavioral lineage tests additionally poison
historical detector counters and demand unchanged facts and profile results.
This is not permission to rename an output into an observational input.

Calendar-only callers derive goal context from their own declared current and
weekly source. This named same-source projection does not read legacy keys or
repair a supplied malformed context. Selected FULL detail instead supplies an
activity-day context from the canonical protected-use projection. Its behavior,
current baseline comparison, weekly series, transition edges and intervention
evidence all use calendar-day time. Its policy charge uses the configured reset
hour; those axes must not be substituted or compared as if identical.

`observed=true` proves an observation marker, not continuous all-day coverage.
Missing precision families retain their existing unavailable/proxy contracts.
A response is a measured event after an eligible intervention; it is neither a
classifier output nor proof that the intervention caused an improvement. Detector
pressure/interrupt history remains diagnostic-only and cannot generate coverage.

The existing score blends behavior, personal references and plan friction. It
remains inspectable on the profile with an explicit `diagnostic_only` meaning;
Intel publishes neither that number nor its derived risk band. Goal-related
claims cannot become the behavior headline. This does not claim every primitive
profile is already goal-independent: separating those mixed profiles requires
the model evaluation described in the migration plan.

Regression owners: `tests/siteAnalysisAuthority.test.js`,
`tests/sitePullContentFlowLineage.test.js`,
`tests/statsSitesSiteDetailReadModel.test.js`,
`tests/targetBehaviorPresentation.test.js`, and
`scripts/ci/check-site-pull-pattern-architecture.mjs`.

### Event scope and composition contract (2026-09-15)

Route v2, TabContext v2, ContentFlow v3, InterventionOutcome v2, Composer v2,
Checking v3 and DecisionQuality v2 ship in model `site-pull-release-v5`.

- `statsSiteTransitionEdges.getDomainTransitionEdges` owns incoming/outgoing
  scope including separately managed children. Its `scopeDirection` is an
  additive query projection field, not a new stored field. Both vector/fact
  normalizers retain it. Unknown direction does not qualify an incoming return.
  The query's existing 8/24 edge cap remains; the fact layer no longer truncates
  it again to 5/12. Distinct pairs are counted by endpoints, not date rows.
  Facts are the profile's only source. Empty weekly edges never borrow the
  separate series. The last seven calendar slots are sliced before observed
  entries are selected; missing slots break streaks. Today intensity does not
  receive a weekly-volume bonus, and one large day cannot imply recurrence.
  Contradictory summary/edge totals fail with `SITE_PULL_ROUTE_SUMMARY_INCONSISTENT`.
- Transition counters are a directional histogram. A return is measured from
  the destination's last exit, not proof of an A→B→A sequence. Historical IDs
  `domain_pair_loop`, `protected_route_return`, and `loop_route_hint` do not
  assert ordered loops or that either endpoint is protected. Scope/sequence
  caveats remain on the evidence; the final copy is descriptive.
- `sitePullTabContextEvidenceProfile` owns tab primitives and their summary.
  Checking projects those same primitives; it has no second tab classifier.
  New/duplicate/same-domain measurements share one snapshot lineage. Site
  intensity uses a maximum. Browser-wide open-tab measurements remain diagnostic
  and cannot increase site intensity or severity. The recorder has no complete
  tab-context sample count, so visit/navigation denominators and tab shares are
  null, not inferred. Tab presence does not establish a reading queue or intent.
- ContentFlow takes maxima inside and across feed/skim/scroll projections;
  overlapping scroll counters are not summed. All remain one feed lineage.
- `sitePullInterventionFacts` owns window/cohort selection, provenance confidence and reentry intensity
  for scores, profiles and contribution explanations. Filtered resistance cohorts
  supply reentry evidence; effectiveness cohorts supply leave observations.
  A filtered empty cohort never reads coarse totals. Missing required cohorts
  fail with `SITE_PULL_INTERVENTION_COHORT_MISSING`. The existing flat-counter
  seam remains explicitly `unclassified_coarse`, with lower confidence (0.55
  versus 0.82 for exposure-linked facts); it is not upgraded to causal evidence.
- Five-minute returns are nested in thirty-minute returns. Invalid populations
  (returns above exposures or five-minute above thirty-minute counts) have null
  rates and cannot emit reentry. Intensity uses only the thirty-minute rate,
  with at least two exposures/returns; weekly selection needs three exposures.
  Repeated today (2/2 and rate ≥0.4) wins, then repeated weekly (3/3 and ≥0.4).
  Otherwise the available return window is selected. No score from the other
  window or another classifier is added. Continue/Escape alone do not activate
  intervention score weights or count as resistance.
- Leave requires two current effectiveness-cohort exposures and two leave
  choices. It can coexist with returns. The aggregate DTO has no mature follow-up
  denominator, so absence of reentry does not establish recovery/effectiveness.
  Historic `intervention_recovery` means observed leave choice. Historic
  `intervention_resistance_loop` is a single-cohort repeated-return summary,
  without other checking components, valence or a friction-step-up recommendation.
- `InterventionEffectStore` attributes deduplicated outcomes to their exposure
  date and rejects outcomes earlier than exposure with
  `INTERVENTION_OUTCOME_BEFORE_EXPOSURE`; it cannot turn negative latency into
  an immediate response. This does not assert that aggregate records contain a
  complete ordered sequence or mature follow-up.
- Decision quality cannot exceed confidence. Family/caveat counts are diagnostic
  only; splitting one signal/caveat into aliases cannot alter quality. Hard
  requirement/calibration gates still apply. No new personal score is exposed.

Tests: `tests/sitePullSequenceCompositionModels.test.js`,
`tests/interventionEffectStore.test.js`, and the existing engine/golden/query
contracts. No collection event, storage key, average/baseline DTO, settings policy,
or Intel layout is added. Output→fact/baseline dependency guards stay mandatory.


## Intel reading contract v3 (2026-09-15)

The existing terminal `sitePullInterpretation.js` owns the reading. The leaf
`sitePullInterpretationEvidence.js` declares a readout for all 41 pattern IDs.
It selects fields and message IDs from admitted evidence; it does not calculate
detector scores, thresholds, references, interventions or recommendations.

| DTO field | Meaning and consumer rule |
| --- | --- |
| `headline` | pattern/surface/message IDs, or one of collecting, observed_zero and unclassified. Policy and supporting-only items never become behavior headlines. A claim without observable metrics is deferred. |
| `reading.claims` | One readout per admitted detail item: role, headline/explanation keys, metrics, model quality state, limitation keys and diagnostic caveats. The explanation key is nullable for policy/state items and validated against the canonical descriptor. Policy entries retain IDs and their original feedback item; this behavior readout does not reformat caps. |
| `metrics[]` | Stable ID, original evidence field, label key, numeric/null value, unit (duration_ms/count/days), observed/unavailable status, period ID and pattern/family/kind/cohort provenance. A zero remains zero. A missing field remains null and is not displayed as a number. |
| `reading.primaryEvidenceIds` | At most two observable metrics from the selected headline's own surface item. UI does not fill spare slots from another claim, diagnostic contribution or confidence percentage. |
| `reading.expandedSurfaceItemIds` | At most three behavior/supporting items in domain-selected order, primary first. Supporting observations can remain inspectable in the unclassified state. Missing/observed-zero states do not claim activity. |
| `reading.policySurfaceItemIds` | Policy context is retained separately; caps and existing explicit actions keep their current owners. |
| `reading.periods` | Named current calendar day, current-inclusive weekly window, completed personal-reference source history and canonical trajectory reference windows. Dates/observation counts come from the validated source; no activity-day substitution. |

For Checking composition, metrics explain the observation dimensions actually
admitted by Composer. A short-session summary does not spend its second slot on
an unrelated zero return count. This is terminal field selection, not a new
classification. Individual count metrics never become independent confidence
votes. Time-pressure comparisons appear only when that reference channel was
admitted; ratios and transformed duplicates are not additional primary metrics.
The explanation also follows those admitted dimensions: entry plus short sessions
does not describe a return sequence, and entry plus direct navigation does not
claim an unproven denominator relation. Other compositions use a general same-day
co-occurrence explanation. No explanation returns to the classifier.
Zero stays in typed metrics and disclosure. An unrelated zero activity does not
fill a primary slot; actual zero model-reference values remain eligible as part
of a comparison. A headline requires a positive measured/aggregate observation,
not a reference value alone. This selection does not relabel observed zero as
missing or change any detector threshold.

Intervention metrics retain the selected today/weekly window and required
resistanceEligible/effectivenessEligible/unclassified_coarse cohort. Background
weekly metrics read only the named weekly fields. Feed decision counters are
never admitted. Browser-wide context, hourly proxies, session intent, sequence
uncertainty, overlapping background records and immature intervention follow-up
have explicit disclosure copy rather than a numeric success/risk label.

Period coverage describes observation markers, not whole-day capture or a
particular metric's sample denominator. Personal-reference dates label the source
history, not a claim that every day supplied a measured session. The trajectory
owner currently publishes comparison values without their complete date windows:
these period ranges are null with `range_not_published`. The UI must not invent
previous-week dates or rebuild baseline slicing. Extending those dates belongs
to the baseline owner in a separately versioned change.

`requireSitePullInterpretation()` validates version, references, source-field
provenance, units, period semantics and model quality; it accepts object-key
reordering across serialization. Invalid readouts fail explicitly rather than
rebuilding old headline/chip logic. UI `siteIntelReading.js` formats each metric
once and resolves primary IDs over that formatted map. Shared and Zen consumers
use this same projection; translation stays in the sites locale. No layout-owned
metric sort, confidence threshold, polling, storage key or extra query is added.

The input rejection contract also reserves `reading`, including null, as final
output. The transitive direction guard includes the new evidence-readout leaf
and detector/fact-summary callers. Tests live in
`tests/siteIntelReadingContract.test.js`, with raw source scenarios in
`tests/helpers/siteIntelReadingFixture.js`. Display examples are recorded in
`reports/site-intel-reading-contract-cases-2026-09-15.json` and are fixtures,
not real user observations.


## Reading presentation consumer (2026-09-15)

The registered Node QA protocol
`scripts/qa/protocols/dashboardSitesIntelJourney.mjs` checks producer-owned source
DTOs directly and no longer imports `buildSiteIntelPresentation`. Its former
private-leaf import exception is retired; external callers use `sites/index.js`.
The shared-seam guard still validates the existing projection's raw Node
importability, single function export and local-JS closure. The presentation
implementation does not acquire evidence, storage or pattern-selection authority.

siteIntelPresentation.js is the shared presentation projection of the unchanged
v2 terminal reading. It preserves original numeric values/units/fields/periods/
provenance with formatted labels and resolves primary and expanded IDs exactly
as published. It does not use diagnostic contributions or select a new pattern.

Only explicit same-measure current/reference pairs (time, session, entry,
switching, return and canonical trajectory averages) render comparison bars.
Other admitted claims deliberately render independent measurements, including
overlapping background, feed, intervention and same-day composition. The graph
scale is the maximum of that pair, with zero origin; it has no risk meaning.

The shared error boundary and all theme wrappers consume the same reading.
No model version, interpretation version, persisted shape or acquisition changes.
The architecture guard now verifies this shared consumer instead of a retired
Zen-only composition; the output-to-facts/baseline direction guard remains intact.

The release temporal display is a separate query-owned output, after facts and
interpretation are computed. Its v1 contract contains existing usage/visit buckets
and source/period/coverage metadata. The shared temporal-link allowlist validates
that a displayed metric has matching units, family, range and recorded total.
No session/feed/background occurrence time or 30-day recurrence is inferred from
the seven-day field. The architecture guard checks the new query/display seams
and prohibits temporalContext reads in feature/facts/scoring owners; the retired
expanded-history component is removed.
