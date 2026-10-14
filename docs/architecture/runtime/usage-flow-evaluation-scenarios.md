# Usage Flow Evaluation Scenarios

- Status: Active
- Owner: usage-flow measurement and model evaluation
- Last validated against code: 2026-09-08
- Path policy: current-only
- Canonical for: independent synthetic usage-flow observation contracts, confirmed-boundary baseline and pressure-candidate comparison, and inference limits

## Purpose and ownership

This corpus tests whether measurements preserve the meaning of observations before
any behavioral classifier is trusted. It is an offline, synthetic replay corpus.
A passing result is not a browser QA PASS, evidence of real-site capture accuracy,
or validation that a model understands a person's intention.

The executable corpus and its manually calculated expectations live in
`scripts/dev/usage-flow-evaluation/scenarios.mjs`. That file imports no production
classifier, thresholds, profile defaults, or existing QA fixtures. This document
owns the rationale and review criteria; it does not maintain another numeric
expectation table. Production measurement ownership remains in the related
runtime architecture; these scenarios cannot become runtime policy.

The initial corpus was authored from the user's product requirements and the
project philosophy without opening the production implementation or existing QA
fixtures. Prior audit findings about model limitations were available in the task
context. The observed event contract was coordinated separately. This is an
independently authored oracle, not a blinded external evaluation. It limits one
obvious circularity; it does not make the fictional scenarios empirically
representative of people or websites.

## Oracle boundary

Each scenario has three deliberately separate parts:

| Part | Meaning | May enter a measurement/model? |
| --- | --- | --- |
| `trace` | Explicit availability states and timestamped content-free observations | Yes |
| `expected` | Hand-calculated measurements for the scripted timeline | No |
| `oracle` | Fictional intent, rationale, permitted statements, and required abstentions | No |

Only `trace` may reach the code under evaluation. An expected result must not be
created by running that code and copying its answer into the fixture. A scenario
title such as "unwanted" is an author's fictional story, never a feature or
ground-truth label available to the production model.

`usageFlowScenarioRelations` expresses cross-scenario arithmetic and
identifiability requirements. In particular, two different fictional intentions
share exactly the same trace. Their measurements must be equal. A classifier
cannot distinguish the intentions without additional independent evidence.

## Observation contract

A trace covers `[startMs, endMs)`. It starts with a full availability event and
has no events at the closing boundary. Events at the same timestamp retain their
written order. An availability transition therefore applies to subsequent
events at that timestamp. Every availability event specifies all three channels;
missing state must not silently mean an available sensor.

`initialInterventionActive` is a required boolean supplied with the trace. Most
fixtures explicitly start unexposed; `initially_active_intervention` starts with
a known active exposure. Absence of an activation event is not evidence of an
initially inactive intervention: a caller that does not know
the initial state cannot submit this complete-observation contract. A future
live capture integration must establish that state independently.

The corpus uses one document per trace and contains no actual text, URLs, DOM
paths, clipboard payloads, submitted content, or persistent identities.

| Event | Explicit fields | Limit |
| --- | --- | --- |
| `availability` | `feed`: supported / unsupported / unavailable; `input`: available / unavailable; `visibility`: visible / hidden | Visibility does not establish attention |
| `feed_advance` | `screenfuls`, `itemTransitions`, `source`: user / programmatic / unknown | Movement does not establish reading, intention, or fixed content amount |
| `input` | `mode`: typing / composition / paste | Event counts do not establish characters, WPM, writing duration, or one draft |
| `intervention` | `active`: boolean | Actual exposure is a treatment fact, never a reason that the intervention was justified |

Both progression units must be present, nonnegative, and at least one must be
positive. The timeline helpers only construct authored event sequences; they do
not calculate the expected measurements.

Feed rates divide confirmed user progression by supported, visible observation
time. Missing coverage produces no rate when the denominator is zero; it does
not produce a zero rate. Unsupported and unavailable visible time remain
distinct from hidden time. Valid evidence before and after a gap remains valid,
but cannot describe the missing interval or imply uninterrupted observation.

The replay deliberately supplies some feed/input candidates during hidden,
unsupported, or unavailable intervals. These are rejection probes. They do not
claim that a real observer captured an event while disabled. The expected result
excludes those candidates and exposes their exclusion count.

There is no item enter/exit identity in this contract. A long gap between advances
cannot be called item dwell, reading time, or rest. There is also no document
identity spanning tabs: the reference-return scenario can establish a hidden
interval followed by renewed input, but not that the same draft continued.

## Scenario families

| Family | Scenarios | What a failure reveals |
| --- | --- | --- |
| Useful sustained input | `long_draft`, `fast_long_draft`, `reference_visit_return` | Input density or a hidden gap is being converted into unjustified intent or draft identity |
| Indistinguishable intentions | `short_reactions_unwanted`, `short_reactions_deliberate` | Fixture narrative leaks into inference, or an unidentifiable intention is asserted |
| Rhythm lost in aggregation | `skim_then_long_gap`, `even_progression_same_volume` | An average is being presented as the full rhythm or as evidence of reading |
| Volume versus rate | `four_screenfuls_fast`, `four_screenfuls_slow`, `eight_screenfuls_same_rate` | A volume quantity is being used as a temporal rate |
| Coverage by channel | `unsupported_feed_with_input`, `input_channel_unavailable` | A missing sensor erases another sensor's evidence or becomes a false zero |
| Gaps and activation | `hidden_document`, `capture_failure_gap`, `activation_mid_session` | Hidden/missing time enlarges the rate denominator or retrospective coverage is invented |
| Input granularity | `ime_composition`, `single_paste` | Input event counts become text amount, effort, or inferred typing speed |
| Movement lineage | `programmatic_scroll_only`, `unknown_scroll_source` | Page-driven or unresolved movement becomes confirmed user progression |
| Actual exposure | `actual_intervention_exposure`, `initially_active_intervention`, `exposure_crosses_hidden_interval` | Treatment contaminates behavioral evidence, missing initial state erases exposure, or mounted time becomes visible exposure |
| Measured absence versus absence of measurement | `supported_quiet_window`, `unavailable_quiet_window` | No-event intervals are treated alike despite different coverage |

## Review and acceptance

Review a changed expectation from the authored timeline first. Record the reason
for changing the scenario story or measurement contract; a classifier failure
alone is not a reason to change the oracle. Keep counterexamples that expose a
known limitation instead of dropping them to produce a green summary.

The executable checks protect numeric expectations and relations. Natural-language
permitted conclusions and abstentions are review criteria; a runner that does
not parse or enforce them must say so. Do not count their mere presence as tested
behavior. No "intent accuracy" percentage is meaningful for these scenarios.

The current corpus can validate units, availability accounting, and inference
limits. It deliberately does not select a preferred feed classifier, establish
behavioral thresholds, infer writing episodes, or enable interventions from new
measurements. Aggregate equality in the two rhythm scenarios is a documented
information loss, not proof that their usage flows are equivalent.

Before any future automatic intervention uses a revised model, add independent
temporal expectations for its actual input granularity and integration evidence
from authored DOM, lifecycle, permission and intervention fixtures. Include useful
fast activity and ambiguous behavior. No phase requires collecting real-user
data. Synthetic correctness, browser delivery correctness and behavioral validity
remain separate outcomes; synthetic evidence does not certify arbitrary real-site
capture or a person's intention.

## Confirmed-boundary model evaluation

This second corpus evaluates a different seam from the complete-observation
contract above. It replays the current `FeedBurstMachine` / `FeedFlowJudge` /
`FeedHorizonSeamGate` lane after forward advancement has been confirmed. It does
not evaluate DOM discovery, the attention/binge detector lane, personal learning,
Enso admission or a visible intervention. Production behavior is retained for
this baseline; known counterexamples remain findings rather than new expected
production answers.

| Concern | Owner | Authority |
| --- | --- | --- |
| Fictional traces, relation hypotheses, sweep recipes and splits | `scripts/dev/usage-flow-evaluation/flowModelScenarios.mjs` | Executable corpus SSOT; imports no product or existing QA code |
| Exact confirmed-boundary trace validation | `scripts/dev/usage-flow-evaluation/flowModelTraceContract.mjs` | Shared input contract for baseline and candidates; distinct from the complete observation-window contract |
| Production-owner replay | `scripts/dev/usage-flow-evaluation/currentFlowModelReplay.mjs` | Only `trace` enters the replay; reports represented and missing channels |
| Baseline output validation and evidence classification | `scripts/dev/usage-flow-evaluation/evaluateFlowModel.mjs` | Evaluation only; also owns shared corpus metadata validation |
| Timed curve comparison, trace interpolation and local refinement | `scripts/dev/usage-flow-evaluation/flowModelDiagnostics.mjs` | Shared diagnostic arithmetic; callers select metrics and validate model output |
| Command and source-hashed artifacts | `scripts/dev/usage-flow-evaluation/runFlowModel.mjs` | `npm run evaluate:flow-model` writes `.artifacts/flow-model-evaluation/report.json` and `report.md` |
| Evaluation/runtime isolation | `scripts/ci/check-nudge-domain-owner-architecture.mjs` | Forbids corpus imports and runtime use of evaluation stories or expectations |

The trace has a half-open interval, a continuous/paged surface declaration, and
timestamped advance, supply, availability and input events. `quality` is supplied
detector confidence, not a probability of attention. Fictional purpose, scenario
identity, split, family, expectations and oracle constraints remain outside model
input. The adapter uses the shipped default configuration without semantic-site
overrides, returns only deterministic projections, and feeds no decision back
into the model.

An advance here means a confirmed boundary event, not raw browser movement.
Backward intent, input, visibility/availability and source provenance are not
represented by this replay. Such events reconcile the clock, but they do not
manufacture the upstream signals needed to represent those channels. Missing
channel support makes the associated relation unsupported; equal outputs from
ignored inputs cannot become a passing test of those inputs. Source labels in a
fictional trace therefore do not prove live user attribution or permission gates.

Confirmed fresh-item counts are unmeasured and are not inferred from transition
counts or supply. The replay consequently cannot establish normal continuous-feed
arming, whose production judge also requires novelty evidence. Separate supply
probes call `ContinuousAdvanceAdapter` with no recent gesture and no pending
movement; an emitted candidate is evidence about that adapter alone, not proof
that the full coordinator would admit it. Supply events never become replayed
advances by construction.

The machine's episode accumulation and the judge's projected episode metrics are
reported separately. After burst expiry they may differ; substituting one for
the other would repair the baseline inside the evaluator. Clocks reconcile only
at authored events and the closing boundary, without an invented polling cadence
or hidden actuator lifecycle.

Identical traces with different fictional purposes and a common timestamp shift
have invariant expectations. Packetization and supply relations are explicitly
design hypotheses with declared channel requirements, not universal invariants.
Different event granularity can lose timing information; in particular, a batch
of paged transitions does not establish each item's dwell. Ordered sweeps expose
sensitivity. A large neighboring delta is a diagnostic requiring local review,
not by itself proof of a discontinuity or a new behavioral cutoff.

The command exits `0` when evaluated checks have no findings, `2` when a valid
evaluation reports findings, and `1` when inputs or the harness are invalid.
Unsupported checks stay visible and never count as passed. A zero exit code with
unsupported checks is not complete model validation. Corpus sizes, relation
counts and numeric results belong to the executable corpus and emitted report,
not a duplicate table in this document.

## Pressure-memory candidate comparison

Phase 2 compares bounded pressure-memory mechanisms at the same confirmed-unit
boundary. It adds no production classifier, observer, persisted model, intervention
decision or actuator. The old production dose remains a reference in its own
units; a smaller candidate pressure is not evidence of higher accuracy. Shared
trace validation and diagnostic arithmetic prevent the baseline and candidate
evaluators from quietly applying different contracts.

| Concern | Owner | Authority |
| --- | --- | --- |
| Bounded accumulation, recovery, provisional configuration and candidate replay | `scripts/dev/usage-flow-evaluation/continuousFlowCandidate.mjs` | Evaluation only; no runtime consumer or learned threshold |
| Fresh analytic-path challenge recipes and relations | `scripts/dev/usage-flow-evaluation/flowCandidateScenarios.mjs` | Independent corpus SSOT; imports neither product nor candidate code |
| Split promotion, model comparison and readiness classification | `scripts/dev/usage-flow-evaluation/compareFlowCandidates.mjs` | Reports each model's native metric, unsupported channels and diagnostic-only relations |
| Comparison command and source-hashed artifacts | `scripts/dev/usage-flow-evaluation/runFlowComparison.mjs` | `npm run evaluate:flow-candidates` writes `.artifacts/flow-model-comparison/report.json` and `report.md` |
| Continuous-drive equilibrium and onset-sensitivity audit | `scripts/dev/usage-flow-evaluation/flowCandidateRecoveryAudit.mjs` | Mathematical review of the declared recovery law; no human-rate or attention prediction |
| Evaluation source manifests | `scripts/dev/usage-flow-evaluation/flowEvaluationSources.mjs` | Metadata-only source-closure SSOT for both commands |
| Before/after source-hash verification | `scripts/dev/usage-flow-evaluation/flowEvaluationSourceSnapshot.mjs` | Rejects source changes during evaluation; supplies provenance, never model evidence |

For a pressure `p` in `[0, 1]` and confirmed mass `m`, the jump is
`J_m(p) = 1 - (1 - p) exp(-m / M)`. Each surface uses its own measured unit:
screenfuls for continuous feeds and item transitions for paged feeds. The two
units are never added or declared equivalent. Same-timestamp partitioning obeys
`J_b(J_a(p)) = J_(a+b)(p)` up to floating-point error. A first confirmed event adds
its measured mass without inventing a preceding dwell interval.

Recovery uses `R(p) = p + gamma * p^2`, ages that coordinate by elapsed wall time,
`R_next = max(0, R(p) - elapsedMs / tau)`, and inverts it back to pressure. The
bounded linear control has `gamma = 0`; the convex candidate has positive
curvature. Its recovery time is `T(p) = tau * (p + gamma * p^2)`, so
`T(2p) > 2T(p)` for positive `p` within the pressure range and recovery is bounded by
`tau * (1 + gamma)`. The nonnegative endpoint is a state-domain boundary, not a
classification of behavior. Configuration values live only in
`FLOW_CANDIDATE_CONFIG`; they are provisional policy parameters, not fitted
estimates of intention or calibrated production defaults.

An unbounded additive pressure combined with slower decay at higher pressure was
rejected during design: continued movement could accumulate unbounded recovery
time after the display had saturated. The bounded jump avoids that hidden debt.
Recent-rate saturation would add another memory and additional parameters; it is
deferred while the simpler control and convex candidate are compared.

Boundedness alone did not settle the recovery design. In the infinitesimal
constant-drive limit, `A = v * tau / M` gives the equilibrium equation
`A * (1 - p) * (1 + 2 * gamma * p) = 1`. The initial `gamma = 0.5` has equilibrium
`sqrt(1 - 1/A)` above onset: continuous, but with an unbounded right derivative
at `A = 1`. Below that curvature boundary the onset slope is `1/(1-2*gamma)`;
above it the model can admit multiple equilibria. The primary candidate moved
to `gamma = 0.25`, a value already in the initial sensitivity comparison, and
`0.5` remains a boundary control. This is a structural selection, not an
intent-label fit. The selected value remains owned by `FLOW_CANDIDATE_CONFIG`.
The audit establishes only local onset behavior in the continuous-drive limit;
it does not predict human attention or certify finite-callback stability.

Clock reconciliation composes the same recovery operation, so adding reads
cannot create mass or change the pressure at shared checkpoints beyond numerical
error. Exact timed partitioning and read-clock relations test these algebraic
properties. Moving observations to different timestamps loses temporal detail:
`temporal_rebinning` remains `diagnostic_only`, with no universal equality or
error-tolerance oracle. Non-refinable discrete trace shapes remain explicit and
do not become continuity passes.

The candidate summarizes detector quality separately, weighted by measured mass;
quality is not a pressure coefficient or an attention probability. Visibility,
availability and source labels are not interpreted as upstream admission proof.
Input, supply and backward events add no forward mass at this boundary and only
age the policy memory. Full input/supply relations consequently remain
unsupported. Equal pressure after adding their timestamps proves clock behavior,
not integrated writing protection, supply discrimination, permission enforcement
or user attribution. No-event decay describes memory aging, not observed rest,
reading, attention or a shared draft.

Every inspected phase-1 scenario is promoted to development evidence for the
comparison, including its former held-out split. Independently authored challenge
families were frozen before their first comparison. After that comparison and the
structural selection, `createFlowComparisonCorpus` receives
`challengeUse: 'reused_for_selection'` and promotes those challenge scenarios too.
The final selection rerun therefore has development evidence only, with no unseen
holdout. It must not be described as fresh held-out validation of the selected
curvature. The historical first-run artifacts remain
`.artifacts/flow-model-comparison/initial-curvature-0.5.json` and `.md`; their
original split must not be relabeled as the final split. Executable corpora and
report metadata own the counts. No split, family, fictional purpose, evaluation
result or oracle enters either replay.

The comparison includes response sentinels: positive measured mass must produce
a response, additional mass must change it, memory must decay, and input without
feed mass must not create pressure. These checks reject zero and constant models
that could otherwise satisfy equality relations vacuously. Primary candidate
readiness also requires the recovery audit to report finite onset sensitivity.
Unsupported channel relations and diagnostic-only rebinning do not become passed
tests through either readiness check.

Both command entrypoints snapshot their declared source bytes before importing
model/evaluator code and verify those hashes again before publishing a valid
report. Changed or missing files invalidate the run. The manifests and hash
helpers contain metadata only and cannot influence pressure, model selection or
scenario expectations. This binds artifacts to a stable source closure; it does
not make synthetic scenarios representative of people or websites.

The comparison exits `0` for `ready_for_integration_evaluation`, `2` for
`candidate_findings`, and `1` for invalid inputs or harness execution. Readiness
means the evaluated candidate properties support proceeding to phase 3. It is
not a runtime cutover, an automated intention-accuracy result, or a pass for
unsupported channels. Synthetic DOM, lifecycle, permission and actual-exposure
integration have their own evidence boundary below; no real-user data collection is required.

## Synthetic DOM integration evidence

`flowDomIntegrationScenarios.mjs` is an independent, import-free corpus of
fictional geometry and platform event timelines. The runner receives only its
fixture and actions. Expected displacement, capability and lifecycle checkpoints
are compared afterward and never passed to observation, classification or policy.
The corpus guard forbids imports and runtime consumption of this evaluation seam.

`tests/helpers/flowDomPlatformHarness.js` supplies jsdom geometry and virtual
clocks. `tests/flowDomIntegration.test.js` uses real `FeedFlowRuntime`, input
capture, native `MutationObserver`, `ObserverHub`, region resolution, learner,
coordinator, judge, topology and safety owners. It replaces the outgoing snapshot
transport with an in-memory sink. Dedicated history tests replace the typed
persistence client with delayed local responses; they do not claim to exercise
IndexedDB transactions, worker restarts or browser host-permission registration.

The independent stories cover native forward/backward displacement, nested
comment scrollers, offscreen supply, unknown provenance, hidden/stale observation,
restart, five minutes of sparse typing/composition/paste, and region replacement.
Region replacement is a DOM lifecycle case, not a navigation test. A separate
test changes the actual pathname through the browser history API, exercising the
real registry's feed-to-document-to-feed capability transitions. The producer
tests also exercise real capture retention across history revocation, rejection
of late restore results, and BFCache stop/restart without catch-up displacement.

Internal diagnostic failures and asynchronous subscriber failures invalidate the
harness result even if later geometry recovers. Cleanup must release its producer
and observation ownership; platform fixtures must not mask unreleased work.
This is DOM and lifecycle evidence. jsdom does not provide browser layout, paint,
extension startup, human perception or site coverage evidence.

Observed `unknownForwardScreenfuls` is not interchangeable with confirmed user
consumption or item transitions. The live sensor's short sample hold is not the
complete availability denominator of `UsageFlowObservationWindow`. It also lacks
a continuous draft-session contract. Consequently the phase-2 candidate remains
evaluation-only; no shim fabricates those missing inputs to obtain live readiness.
Passing zero-feed typing stories proves that these input events add no feed
displacement, not that all long drafts or pauses are identified and protected.

Endpoint tests must distinguish a supplied actuator precondition from natural
detector admission. Real endpoint lease/DOM commit and release establish committed
intervention state; a requested effect, admitted candidate or fake mount callback
does not establish actual exposure. Effect-created layout must also be challenged
through supply observation, since explicit exposure callbacks alone cannot rule
out DOM/geometry feedback into a detector. Global reward evidence and feed
evidence require separate non-feedback claims.

`tests/feedFlowNaturalDomIntegration.test.js` separately connects the real
producer, default episode manager, evidence runtime, spawn policy, endpoint
resolver, lease and surface. The fixed three-minute feed story records a mature
detector with an unearned opportunity; it is not relabeled as a desired policy.
The six-minute development probe was authored after inspecting that blocker and
does not count as an unseen intention oracle. Its input timeline and policy
remain fixed. It exposed a downstream prefix-truncation defect, and the same
timeline exercises actual endpoint commit after that resolver correction.
The separate long-input story exercises the real producer cadence and manager
without feed advances. Only external interaction-listener/gate UI transport is
substituted; downstream detector/admission verdicts are not.

At the long feed's final checkpoint the shadow sensor reports
`unavailable / dom_changed`, following the last delivered DOM mutation. This
snapshot does not establish an item-scan budget failure. Successful legacy
progression/admission does not certify complete support from the new sensor.
Post-mutation sampling, valid coverage intervals and large-feed observation cost
need their own evidence before that sensor replaces the progression path.

The next integration checks exercise physical write facts at the native actuator
boundary. `tests/feedEndpointScrollProvenance.test.js` uses actual endpoint motion
and capture for elastic/release corrections, delayed/coalesced/reentrant events,
partial failures and mixed assistance/adjustment intervals.
`tests/scrollWriteProvenanceIntegration.test.js` keeps real managed scrolling,
resistance and forward-pass routes working through the coordinator while the
shadow sensor abstains on all app-written displacement intervals.
`tests/feedAdvanceCoordinatorScrollWrites.test.js` challenges pending paged,
mutation and media confirmation after an adjustment. No intervention verdict is
injected as physical write evidence. Mechanical purposes come from writer actions;
assistance does not assert a person's attention or intent.

`tests/feedLiveObservationValidity.test.js` challenges half-open sample holds,
accounting timestamps, detached DOM and geometry changes before delayed callbacks,
same-route observation-declaration changes, write failures and poll/event ordering.
The sensor's coverage label describes a bounded sample hold, not complete
availability. Unknown mixed movement is omitted and diagnostic gaps remain visible.
These are development integration contracts, not calibrated behavioral labels or
browser-layout evidence. Browser-driven movement outside the explicit write
boundary remains a separate limit.

### Reward observation / admission isolation

`tests/rewardObservationPolicyIsolation.test.js` replays authored identical
reward-transition timelines through real readiness and spawn owners, varying only
presentation, cancellation, duplicate commit or readiness polling. Compare the
entire canonical observation summary and detector result, not just a chosen label.
Observation and detection must match; cooldown and admission rearm may differ.
Detector-only reads after clicking stops must show decay and idle expiry without
a readiness call refreshing a cache. Later clicks preserve observed intervals
while rebuilding a separate post-presentation admission baseline.

`tests/rewardDriftObservationRuntime.test.js` protects immediate publication,
read-cadence invariance, lifecycle/instance isolation, immutable tuning, explicit
failure on invalid inputs and one checkpoint for an actual tuning change.
`tests/ensoRewardPresentationIsolation.test.js` covers a normal always-mode
click DOM presentation, injected feed commit, inactive observations, reservation
failure and abort, duplicate/same-time commits and revision identity across source
reactivation. Its feed test supplies a real reserved permit to the real commit
method; it does not claim natural feed admission or browser paint. The click case
proves actuation isolation, not adaptive threshold validity.

These fixtures are visible development contracts without a behavioral oracle or
user data. They do not establish classifier accuracy, retained reward's effect on
long cross-channel sessions, or observed pixel/item-unit pressure equivalence.
Time starts at a positive epoch: the inherited pure reward model treats zero as
an absent previous event and loses the first interval when an event occurs at
timestamp zero. That separate time-origin defect is recorded for the next model
evaluation pass, not concealed by a claim of unrestricted time-shift invariance.

## Measured displacement / pressure integration

The next evaluator uses actual live sensor snapshots from authored DOM timelines,
rather than inventing confirmed advancement from snapshot counts. Its independent
corpus is `scripts/dev/usage-flow-evaluation/flowMeasuredPressureScenarios.mjs`:
18 visible development stories and five observation relations, authored without
the pressure implementation or prior QA recipes. Expected values are physical
distance/viewport and bounded-sample time arithmetic. There are no expected
pressure constants, fictional intention labels or threshold fitting.

| Concern | Owner | Limit |
| --- | --- | --- |
| Independent actions and observation expectations | `flowMeasuredPressureScenarios.mjs` | No production imports, copied verdicts or pressure formulas |
| Actual DOM/runtime capture | `tests/helpers/flowMeasuredPressureHarness.js`, existing `flowDomPlatformHarness.js` | Supplies geometry, event delivery and explicit sample cadence in jsdom, not browser paint or real-site validity |
| Displacement-to-memory projection | `flowMeasuredPressureReplay.mjs` | Reuses the candidate's pure math with a distinct unknown-displacement contract |
| Comparison and relations | `tests/flowMeasuredPressureIntegration.test.js` | Observation relations and pressure properties, not accuracy against a behavioral oracle |
| Reproducible execution | `runFlowMeasuredPressure.mjs` | Hashes inputs before imports and after successful evaluation; failed/changing runs cannot leave an earlier PASS as current evidence |

`npm run evaluate:flow-measured` is the canonical offline entrypoint. Only the
trace reaches the adapter: version, `clockBasis=shared_monotonic_milliseconds`,
start/end, and `{ownerId, at, observation}` frames. Capture time and the sensor's
accounting `at` must share a declared clock. Frame ordering, counter monotonicity,
owner event ordering and unsupported-channel contract are checked. Owner identity
is local to a collector run, not a site or persistent user identifier. Replacing
the owner or changing its epoch starts a separate segment at the actual baseline;
pre-capture mass is not retroactively added. Segments are not combined into a
browser-wide pressure score.
Coverage retains a separate `accountingStartAt`/`accountingEndAt` and baseline
accounting lag: a passive first capture can precede the next accounting update.
Its next valid counter delta may cover time before that capture; the evaluator
exposes that interval rather than guessing how to trim it. Coverage deltas must
conserve the actual owner accounting time, and inactive owners cannot advance
business counters or restart without a new epoch.

The measurable unit is **unknown-source displacement divided by scroller height**.
It is neither a read screen nor an item transition. Both forward and backward
totals remain available, but only forward displacement drives this candidate.
Forward revisits are not silently subtracted as known rereading, and backward
movement does not repay pressure. `itemTransitions` and measurement confidence
are explicitly unsupported (`null`). Visible-set/identity changes and legacy
gesture-conditioned item transitions cannot substitute for either.

The following are distinct checks:

- Physical scaling and reader partition preserve measured unit totals.
- Repeated reads add no mass. A single accepted callback can retain its precise
  owner accounting time; no callback-count bonus is added.
- Batched cumulative deltas lose arrival order/timestamps. The two placement
  conventions expose pressure sensitivity; they are not asserted to enclose all
  possible paths. Addition and recovery do not commute, so pressure equality
  across different capture partitions is not a required invariant.
- Explicit gaps, hidden intervals, known app writes and stopped lifetimes do not
  create catch-up movement. Long writing alone contributes zero feed mass. The
  same physical feed movement remains observable when an editor is also active.
- Coverage remains the bounded geometry sample hold reported by its owner.
  Unaccounted tail time stays visible; elapsed-time memory decay does not prove
  rest, observation availability, draft continuity or attention.

The fixed provisional candidate configuration is compared with a priori mass and
recovery perturbations. These are diagnostic sensitivity checks without a winner
search. They cannot authorize live cutover. Paged item measurements and retained
cross-channel reward's admission effects still need separate supported contracts.

## Use journeys and intervention timing review (2026-09-08)

`npm run evaluate:flow-journeys` evaluates authored usage timelines through the
actual feed producer, capture, structure/topology owners, binge detector, judge,
admission policy and endpoint. `flowUseJourneyScenarios.mjs` owns twelve visible
product hypotheses. It imports no model or QA implementation; prior code and
earlier findings were known during authoring, so this is explicitly not blinded
or empirical human ground truth. Expectations are fixed before the first run.

The input contains only a physical fixture and timestamped movement, supply,
virtual-window removal, input/focus and visibility actions. Narrative, desired
descriptions and review windows stay outside the running pipeline. The same
input with different fictional intent must produce the same projected timeline.
Virtualized and append-only DOM stories are a structural sensitivity comparison,
not a claim that their observational support must be identical.

`tests/helpers/flowNaturalPipelineHarness.js` owns the shared synthetic root-feed
platform used by the earlier natural-admission tests and the new journey tests.
It reuses `flowDomPlatformHarness.js` for actual capture/runtime ownership and
only supplies jsdom's missing layout and native API behavior. No candidate,
confidence, readiness, safety, policy override or fake presentation permission is
inserted. Production timers run normally against the authored fake clock; the
evaluation reads at 250 ms or authored action boundaries without extra sampling.
First observed stage times therefore have a bounded read resolution, not exact
internal transition timestamps.

The fake clock is installed at the authored origin, including animation frame
phase. Installing at wall time and subsequently shifting `Date` retained an
execution-dependent frame phase in the first journey run. That harness defect is
recorded in the dated report; narrative invariance is still an exact timeline
comparison, with no numerical tolerance added to hide it. Simulated clocks do
not establish real CPU cost or browser rendering performance.

`flowUseJourneyEvaluation.mjs` separately records detector candidate, armed,
usable opportunity, admission and active endpoint. Candidate/armed flags alone
cannot satisfy an actionable preparation window. A sampled admission/endpoint
can establish observed preparation even if a short intermediate opportunity
state was not sampled; its earlier exact time is not reconstructed. Protected
flow windows reject usable opportunities as well as admission/exposure. Positive
stories prevent a disconnected or constant-zero pipeline from passing only
negative cases. An action-withholding result does not claim recognition of
writing or healthy behavior.

Delivery is a separate observed result: `endpoint_observed`,
`endpoint_unobserved_after_admission`, or `not_admitted`. A successful preparation
review does not claim successful delivery. Sampled visible coverage and its final
availability reason are diagnostic measurements, not fitted pass thresholds or
behavioral classification accuracy.

The first active endpoint is a predeclared censoring boundary. Remaining authored
actions are not executed or credited as untreated evidence after the application
changes the page. An unobserved protected tail cannot pass by omission. The
separate Enso choice UI and subsequent human response are outside this phase.

Review windows are deliberately provisional product choices. A miss, an early
opportunity or a delayed opportunity is a model finding, not a failed test
harness and not an empirically established human false-positive rate. The current
decision DTO has no temporal usage-pattern output to score against the desired
descriptions; this capability is explicitly unsupported in every journey. No
Sites history projection or replacement classifier is fabricated for a pass.

The CLI reuses the existing broad source inventory/hash owner, checks the
repository Node version, runs the real integration in a fresh child and
recomputes assessments from recorded rows and the canonical corpus. An interrupted,
failed or source-changing run invalidates earlier success. Exit 1 is execution
invalidity; exit 2 is a valid run with model findings; exit 0 means the tested
review hypotheses passed while unsupported pattern capability remains explicit.

The dated interpretation and Sites handoff boundary are recorded in
`reports/feed-flow-use-journeys-2026-09-08.md`. That report is run evidence, not
another expectation or production policy owner.

The retained-DOM follow-up corrects one platform omission in that first evaluation:
`tests/helpers/flowDomHitTesting.js` supplies axis-aligned point hit testing from
the authored DOM geometry, with no feed selectors or model answers. The existing
coordinator already uses native viewport hits; missing that API falsely dropped
its reference when retained history pushed visible items outside the leading/
trailing fallback scan. Production admission/safety was not relaxed to repair
the test environment. Native hit testing restores that existing path; paint,
transforms and stacking-context fidelity remain outside jsdom evidence.

`feedRetainedDomDelivery.test.js` preserves the authored append-only story as an
actual endpoint and observation regression. `feedObservationViewportWindow.test.js`
adds long-history jumps, pruning, node reuse, dense-window abstention and grid
neighborhood checks. The production sensor now reports the explicit local window
scope described by the runtime architecture; a high sampled-time ratio is not
complete viewport coverage. Journey records include this scope and safety reasons.
Before applying actions at each checkpoint, the harness also checks for exposure
that occurred while the clock advanced, so post-exposure actions are censored.

## Temporal descriptive candidate (2026-09-08)

`npm run evaluate:flow-temporal` is a separate evaluation-only candidate. The
production journey DTO still has no temporal classifier; its unsupported result
does not become a pass merely because this offline candidate exists.

| Concern | Owner | Boundary |
| --- | --- | --- |
| Retained journal validation, cursors, baselines, losses and available-at times | `flowObservationTraceReader.mjs` | Shared by journal pressure and temporal interpretation; typed factory validates actual feed/editor journal contracts |
| Runtime editor snapshots into normalized event facts | `projectEditorObservationTrace.mjs` | Uses the same cursor reader; no event listener, policy or reconstruction of a missing input prefix |
| Continuous temporal descriptors and time-scale configuration | `flowTemporalInterpretation.mjs` | Only retained observations plus an explicit editor observation channel; no policy or corpus import |
| Physical recipes and fictional review narratives | `flowTemporalScenarios.mjs` | No imports; visible development cases, not blinded human truth |
| Authored geometry into actual identity/journal records | `flowTemporalObservationFixture.mjs` | Uses existing sample-hold, item-boundary accounting and journal capacity owners |
| Review hypotheses | `evaluateFlowTemporal.mjs` | Separate from model inputs; findings do not select parameters |
| Source-hashed CLI evidence | `runFlowTemporal.mjs` | Same broad before/after source inventory as other measured evaluations |

All script paths in this table are under `scripts/dev/usage-flow-evaluation/`.
The older journal pressure consumer retains its public output and loss semantics.
Its trace-validation errors now belong to `FLOW_OBSERVATION_TRACE_INVALID`; record
errors still belong to `FEED_OBSERVATION_JOURNAL_INVALID`.

The candidate has two exponential time constants, initially 8 s and 40 s. These
are explicit descriptive choices, not learned optimal timings. For a query at
`t`, an observed displacement `u` at `s` contributes `u * exp(-(t-s)/tau) / tau`
to its rate (converted to screenfuls/second). Forward and backward evidence stay
separate. Their ratio is descriptive; neither movement source nor user intent is
established. No physical amount is multiplied by a callback-count bonus.

Geometry support integrates the exponential kernel only over a sample's bounded
hold, ending at displacement, the next sample, invalidation, expiry or the known
start of a cursor-loss interval. It is normalized by elapsed kernel mass since
the segment baseline; `historySpanMs` preserves cold-start context. Current sample
availability remains separate from remembered support. Gaps are not stable time.

Consecutive samples with producer-certified continuity and matching previous
timestamps provide weighted visible-area overlap (intersection/union by retained
item ID). The comparison contributes only its actual bounded held interval. A
new baseline or an unobserved pair supplies no stationarity claim. Comparison
support is reported separately from the conditional matched-area share. Retained
identity reentry is an area-weighted share among observed entering identities;
it is neither a first-ever/repeat consumption rate nor a user's reason to return.
The content-hint/node-only/ambiguous-hint proportions of sampled area-time stay
explicit in the output. These are provenance shares, never calibrated identity
confidence. Local window scope and eviction limits remain inherited.

The normalized editor channel has only `editor_state {at, availableAt, available, focused}` and
`input_activity {at, availableAt}`. The adapter adds capture-arrival time to the
runtime's typed event facts. Availability loss uses `focused: null` and interrupts
input recency. Focus contributes supported editor-presence time; input recency
is `exp(-(t-lastInputAt)/tau)`, so same-time event batches do not award additional
engagement. Neither focus nor lack of input establishes ongoing writing intent,
one draft's identity, submission, thinking or rest. An editor epoch or document
owner change needs a fresh editor baseline; a feed owner epoch alone does not
reset still-observed writing in the same document. Unsupported input history is
never reconstructed from feed counters or admission inhibitors. An unseen editor
epoch change closes support conservatively at the previous capture, available
only when the new baseline arrives. A missing state prefix withholds retained
input until a known state reestablishes support.

Only records available at the requested read enter its estimate. Sparse readers
may therefore have delayed evidence. Complete retained histories agree at a
common read; later snapshots cannot alter an earlier requested estimate. A
cursor loss is explicitly partial for that segment. Known subsequent samples can
support new local descriptions, but missing movement is not replaced with zero
as a complete-history assertion. This differs deliberately from pressure, whose
complete accumulated value stays null after loss.

The output is a pair of descriptive vectors, without argmax labels, probabilities,
intervention thresholds, calibrated confidence or a Sites history writer. This
permits movement, editor activity and geometric stability to coexist. The CLI
keeps fixed 0.8x/1.25x time-constant perturbations as diagnostics and never chooses
a winner. Tests also vary movement continuously, reader cadence, same-time
callback partition, item density, missing records and input volume.

`npm run evaluate:flow-temporal-dom` now uses the actual `FeedObservationRuntime`
sampling cadence and both capture/journal owners. It replaces test-owned editor
listeners with the explicitly enabled, default-off production memory channel.
`flowTemporalDomScenarios.mjs` independently authors thirteen physical scenarios:
irregular changing movement, list/grid density, variable item heights, virtual
node reuse, nested comment scrolling, writing only, input batches, ambiguous
regions, visibility loss, same-region recovery, physical region/scroller replacement
and route changes. Review hypotheses report findings independently
from successful execution. Additional integration contracts exercise no implicit
grant, grant without demand, revocation and BFCache. The same displacement must
retain its units across layouts, and same-time input batches cannot earn recency.

`tests/helpers/flowTemporalDomHarness.js` supplies only jsdom geometry, physical
actions and time. It does not inject surface certification, detector scores,
admission or interpretations. `runFlowTemporalDom.mjs` captures the broad source
inventory before child imports and verifies it after execution. These are
synthetic DOM results, not named browser QA, representative typing behavior,
classification accuracy or validated optimal intervention timing. The existing
11-case authored-journal evaluation remains a separate source of evidence.

The initial 2026-09-08 DOM run retained one finding: variable card heights changed the
generic `surfaceMode` from hybrid to continuous and back without a semantic
identity change. Those changes previously started new live observation epochs,
so the current-segment temporal reader dropped earlier movement from its rate.
The observation continuity cutover now projects only route/target declarations
and fences physical region/scroller replacements independently of structural
classification. Tests keep the original recipe and require its movement units
to match the equivalent list, while real region/scroller/route replacements must
start a new epoch. Visibility recovery within the same owner retains measured
history while closing unsupported intervals. The original classifier threshold
and policy-transition notifications are unchanged; notifications remain report
diagnostics only, never interpreter inputs. See
`reports/feed-flow-temporal-dom-2026-09-08.md` for the original counterexample.
The follow-up 13-case DOM run has no findings; the original 11-case journal run
also remains consistent. Source-hashed evidence, the unchanged classifier mode
transitions and remaining limits are recorded in
`reports/feed-flow-observation-continuity-2026-09-08.md`. These are synthetic
continuity-contract results, not population classification accuracy.

## Evaluation-only preparation consumer (2026-09-08)

`npm run evaluate:flow-preparation` evaluates a downstream policy without promoting
it to Enso admission, feed actuation or Sites history. `flowPreparationPolicy.mjs`
imports only `flowTemporalInterpretation.mjs` and its shared validated observation
reader; temporal interpretation cannot
import the policy or corpus. Existing runtime permission, entry grace, endpoint
readiness/safety and renewed-demand owners retain their authority. No setting,
editor grant, listener, timer, storage or runtime decision is added by this work.

| Concern | Owner under `scripts/dev/usage-flow-evaluation/` | Boundary |
| --- | --- | --- |
| Current editor state, state-start/input/forward timestamps and movement continuity | `flowTemporalInterpretation.mjs` | Facts from the existing available-at reader; duplicate identical state reports do not reset the state-start timestamp |
| Preparation interest, protection and opportunity weights | `flowPreparationPolicy.mjs` | Pure downstream evaluation judgment; no scores or previous judgments accepted as evidence |
| Physical scenarios and query times | `flowPreparationScenarios.mjs` | Import-free development corpus, including an isolated return followed by idle time |
| Product relationships and counterexample findings | `assessFlowPreparation.mjs` | Independent from the policy coefficients; a finding is compatible with valid execution |
| Reproducible evidence and fixed sensitivity sweep | `runFlowPreparation.mjs` | Broad before/after source hashes; no parameter selection |

The temporal descriptor now also exposes `editorFocused`, `editorStateSinceAt`,
`lastInputAt`, `latestForwardAt` and `movementContinuitySinceAt`. Null current editor
state means unavailable; null input/forward timestamps mean no retained event in
that scope, not proof of a user's inactivity. State timestamps change only on
observed value changes. Movement continuity starts at the segment baseline and
advances on explicit gaps, detected cursor loss or sample-expiry recovery. All
timestamps obey capture-arrival causality, including delayed loss discovery.

The provisional policy separates these components:

- Remembered forward mass is the slow exponential rate multiplied by its time
  constant, in screenfuls. Interest is `1 - exp(-mass / 12)`. Twelve screenfuls is
  an explicit evaluation coefficient, not a calibrated threshold. Slow movement
  contributes less; stationary time and typing add no movement mass. This is
  bounded recent memory, not total browser attention or long-term habit.
- Current observed editor focus protects fully, including thinking without
  input. Neither focus nor its absence establishes one draft's identity or intent.
- Opportunity requires a measured forward event strictly after the current editor
  state start, latest input and movement continuity boundary. Equal timestamps
  cannot prove cross-channel order. Merely blurring or restoring geometry does
  not count as renewed progression.
- After that boundary, newly measured forward displacement contributes to a fast
  exponential renewal mass. Renewal weight is `1 - exp(-mass / 1)`, with the one
  screenful scale an explicit provisional coefficient. The policy selects records
  through the shared reader; policy-specific renewal mass does not enter the
  neutral temporal descriptor or production journal. Complete capture cadence and
  same-time callback partition cannot create extra mass.
- With current geometry/editor facts supported, opportunity combines absence of
  current editor focus, renewal weight and forward directional share. Historical
  support fractions remain diagnostic; growing support or decaying editor focus
  memory cannot release protection through idle time alone.
  Interest times opportunity is a preparation weight, not a probability or an
  intervention verdict. Unknown scroll source remains unknown user intent.
- Missing current geometry/editor support withholds the opportunity as null.
  Cursor loss also withholds whole-segment interest until a new baseline; a
  retained suffix is not silently declared complete. No normal runtime editor
  capability is implicitly granted to make this policy available.

Fifteen physical scenarios include long/slow/batched writing, focused reference
scrolling, repeated switching, gaps, loss and observationally identical purposeful
search. Eight fixed 0.8x/1.25x perturbations vary physical speed, interest mass scale,
renewal mass scale and time constants independently. Their findings remain in the report; the runner does
not choose a winning coefficient or claim a behavioral accuracy percentage.
Targeted synthetic DOM integration also uses the actual feed/editor producers,
typed journals and editor adapter. This is not named browser QA.

The initial isolated-return case found that decaying writing protection amplified
preparation after movement stopped (0.03373 at 181 s to 0.07415 at 185 s), across
all six initial perturbations. The policy now releases through renewed measured
movement instead. The original story and relationship remain unchanged; no output
threshold was relaxed or stationary time reclassified as exploration. Full source
hashes and original/final execution IDs belong to the phase report.
The final 15-case evaluation and all eight fixed perturbations have no findings;
95 targeted tests pass with the standard Vitest reporter. See
`reports/feed-flow-preparation-policy-2026-09-08.md` for the preserved counterexample,
source-hashed evidence, verification caveats and the limits on runtime promotion.

## Broad development phases

| Phase | Work | Readiness to continue |
| --- | --- | --- |
| 1. Baseline counterexample map | Preserve current behavior; replay independent fictional traces, distinguish unsupported channels, test identifiability and investigate sensitivity | Runs are reproducible, limits are explicit and the largest structural failures have source-backed explanations |
| 2. Continuous candidate comparison | Compare observation-unit-based accumulation, cadence and recovery candidates; revisit phase 1 assumptions as counterexamples emerge | Candidate behavior is explainable across development and reserved recipe families, with acceptable tradeoffs and no oracle feedback |
| 3. Synthetic integration | Exercise authored DOM geometry/mutation, capture cadence, lifecycle, permissions and actual intervention exposure through owning boundaries | Measurement and delivery contracts hold together; intervention state cannot become evidence that its own judgment was correct |

These are broad work packages, not one-way gates. Useful progress is sufficient
to start the next package while new evidence improves earlier assumptions.
Readiness describes implemented coverage and understood limitations, not an
accuracy percentage or a claim that intention has become measurable.

Reserve families by generation mechanism, not by randomly splitting variants of
one recipe. The initial reserved families combine drift, irregular pauses,
backward movement, observation loss, mixed provenance and writing, and include
irregular transformation pairs. They are public synthetic recipes, not a blinded
test or a representative population. Once their results guide a revision, treat
them as development evidence and reserve new mechanisms for the next comparison.
Do not tune thresholds until every fictional story receives a desired label.

Behavioral duration, speed and recovery should be evaluated as continuous
quantities with uncertainty and competing interpretations. Hard boundaries remain
appropriate for permissions, invalid data, unsupported measurement and explicit
user choices. A final discrete intervention decision needs its own policy and
delivery checks; smooth model outputs alone do not justify it. Long writing alone
should not add feed movement evidence. The editor channel now supports descriptive
integration checks; a production pressure or labeling consumer still requires its
own explicit cutover and evaluation.
