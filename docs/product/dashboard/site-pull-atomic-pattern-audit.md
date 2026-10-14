# Site Pull Atomic Pattern Audit

- Status: Draft
- Owner: stats domain / dashboard product
- Last validated against code: 2026-06-22
- Path policy: planning-allowed

This audit records how the current site-pull atomic and state patterns are judged before adding more pattern logic. It is intentionally code-facing: the goal is to stop trusting detector output blindly and make every badge claim traceable to required local facts.

## Scope

Audited code paths:

- `src/domains/stats/insights/sitePull/patterns/evaluateSitePullPatterns.js`
- `src/domains/stats/insights/sitePull/patterns/detectors/dataPlanPatterns.js`
- `src/domains/stats/insights/sitePull/patterns/detectors/baselinePatterns.js`
- `src/domains/stats/insights/sitePull/patterns/detectors/checkingRoutePatterns.js`
- `src/domains/stats/insights/sitePull/patterns/detectors/navigationFlowPatterns.js`
- `src/domains/stats/insights/sitePull/patterns/detectors/sessionShapePatterns.js`
- `src/domains/stats/insights/sitePull/patterns/sitePullCheckingEvidenceProfile.js`
- `src/domains/stats/insights/sitePull/patterns/sitePullPatternDefinitions.js`
- `src/domains/stats/insights/sitePull/patterns/sitePullPatternRequirements.js`
- `src/domains/stats/insights/sitePull/patterns/sitePullPatternCalibration.js`
- `src/domains/stats/insights/sitePull/patterns/sitePullPatternCalibrationAudit.js`
- `src/domains/stats/insights/sitePull/patterns/sitePullPatternThresholdAudit.js`
- `src/domains/stats/insights/sitePull/buildSitePullFacts.js`
- `src/domains/stats/insights/sitePull/personalBaseline.js`
- `src/domains/stats/insights/sitePull/scoring/sitePullScoreModel.js`

Composite patterns are not the main target here, but their component contracts are noted where they affect atomic interpretation.

## Current Data Families

| Family | Source shape | Consent / availability meaning | Patterns using it |
| --- | --- | --- | --- |
| Usage / goal | `featureVector`, `facts.usage`, `facts.goal` | Basic protected-site/domain usage facts | `goal_exceeded`, `goal_missing`, `goal_kept`, `time_heavy_today`, `deep_immersion`, `daily_habit`, `rising_trend`, `late_night`, `late_night_binge`, `controlled_brief_check` |
| Entry / visit | `facts.entry`, `todayVisits`, `todayHourlyVisits` | Visit facts available or inferred from hourly visits | `checking_pattern`, `visit_spike` |
| Session shape | `facts.session`, `todaySessionStats`, hourly usage estimates | Measured domain sessions when available; otherwise conservative visit/hour estimates | `deep_immersion`, `session_depth_spike`, `focused_block`, `session_fragmentation`, `controlled_brief_check` |
| Personal baseline | `personalBaseline` from the explicit `baselineSeries` + `baselineCurrentDateStr` source contract | Exact 30 completed calendar days excluding current; missing days remain `observed=false, activeMs=null`, and `weeklySeries` is never a baseline source | `personal_spike`, `visit_spike`, `reentry_spike`, `quick_return_loop`, `switch_churn_loop`, `session_depth_spike` |
| Behavior facts | `facts.behavior` | Precision behavior summaries; currently tab/navigation/feed/scroll aggregates, not click/drag/input | `quick_return_loop`, `switch_churn_loop`, `new_tab_loop`, `duplicate_tab_entry`, `tab_queue_pattern`, `tab_hoarding_context`, `feed_skimming`, `fast_scroll_bursts` |
| Navigation facts | `facts.navigation` | Web-navigation transition summaries | `habitual_entry`, `reload_checking` |
| Transition edges | `facts.transitionEdges` | Domain-level top-edge transition summaries | `domain_pair_loop`, `protected_route_return`, `loop_route_hint` |
| Intervention facts | `facts.intervention` | Gate exposure/outcome aggregates | `intervention_reentry`, `intervention_resistance_loop`, `intervention_recovery` |

## Layer Contract Check

What is strong already:

- Composite ownership is centralized in `sitePullPatternComposer.js`; detector-emitted composite IDs are rejected before presentation.
- Pattern definitions and requirements are locked together by tests and CI.
- Behavior/navigation/transition detectors generally check `hasBehaviorFacts`, `hasNavigationFacts`, or `hasTransitionEdgeFacts` before emitting their family-specific patterns.
- Personal-baseline patterns require `source=personal_baseline` at the requirement layer.
- Presentation suppression is separate from detection, so hidden atomic signals remain inspectable in diagnostics.
- Calibration is centralized in `sitePullPatternCalibration.js`; every defined pattern must declare sensitivity, visibility, score meaning, minimum confidence, sample evidence, and missing-data behavior before it can survive the layer.

What is still loose:

- Calibration thresholds are initial hand-tuned guardrails, not yet validated against broad real-world local distributions.
- `evidenceStrength` now delegates to the versioned decision-quality projection, which keeps detector intensity, confidence, sample depth, threshold headroom, corroborating evidence families, and caveats distinct. Declared caveats apply a bounded quality penalty. The result remains heuristic evidence quality, not probability.
- Badge presentation now applies semantic/group suppression, one visible claim per recommendation family, and a global four-claim cap. Detail/recap/diagnostic surfaces retain the supporting context.
- The selected-site Sites surface now renders primary/supporting claims, reasons, evidence chips, data basis, decision-quality level, boundary proximity, and recommended next-step guidance. Registry and cross-domain recap surfaces remain intentionally more compact.

## Calibration Layer

2026-06-22 implementation:

- Added `sitePullPatternCalibration.js` as the central label-calibration spec.
- The label path is now:
  - detector candidate,
  - definition annotation and dedupe,
  - requirement validation,
  - calibration validation,
  - composite composition from calibrated atomic/state inputs,
  - final requirement validation,
  - final calibration,
  - presentation suppression.
- Each pattern declares:
  - `sensitivity`: `state`, `conservative`, `normal`, `context`, or `exploratory`,
  - `visibility`: `visible`, `supporting`, or `shadow`,
  - `scoreMeaning`: the local meaning of the detector score,
  - minimum score/confidence/evidence-strength,
  - sample evidence keys and sample aggregation mode,
  - missing-data behavior.
- The calibration layer intentionally does not claim that every score is globally comparable. A score is a local detector intensity; `scoreMeaning`, `confidence`, `evidenceStrength`, and sample evidence are recorded together so rules UI can explain why a label survived.
- `supporting` visibility can be changed centrally without editing detector code. `shadow` labels are retained for diagnostics but suppressed from presentation by the presenter.
- Architecture CI now fails if a pattern definition exists without a matching requirement or calibration spec.

## Calibration Audit Harness

2026-06-22 implementation:

- Added `sitePullPatternCalibrationAudit.js` as a tuning harness for label calibration.
- The harness treats tuning as more than number changes. Each label now has an audit row covering:
  - decision gate: state, setup context, subscore threshold, sample threshold, multi-signal gate, personal-baseline anomaly, composite fusion, navigation gate, behavior gate, transition-edge gate, circadian gate, intervention gate, supporting context, or proxy gate,
  - normalization meaning: local detector score, count/rate, baseline-relative, component evidence, context-only, or state,
  - spike handling: none, robust personal baseline, weighted temporal window, baseline optional, or component confirmation,
  - fusion mode: none, component patterns, behavior-or-baseline, context-only, or explicit multi-signal fusion,
  - tuning surfaces: threshold, gate, fusion, presentation, and copy.
- Architecture CI now runs the audit and fails only on blocking structure/policy errors, such as missing specs or an exploratory label becoming primary visible.
- Non-blocking warnings remain as tuning backlog. This is intentional: calibration should reveal weak spots without forcing premature numeric changes.
- This keeps the next phase grounded: threshold tuning can decide whether to adjust numeric cutoffs, add spike dampening, require corroborating evidence, change presentation visibility, or soften copy.

## Checking Evidence Profile

2026-06-22 implementation:

- Added `sitePullCheckingEvidenceProfile.js` as the primary evidence-status layer for checking, re-entry, session-fragmentation, navigation-entry, reload, and tab-context primitives.
- The profile does not create user-facing labels by itself. It turns local facts into status-bearing primitive evidence:
  - `absent`: no usable local evidence,
  - `observed`: a signal exists but is too small to influence a label,
  - `weak`: meaningful supporting evidence for diagnostics/composites, but not enough for a direct label,
  - `candidate`: enough evidence for an atomic label candidate, still subject to requirements and calibration,
  - `strong`: high-confidence evidence that can support composite dominance or stronger copy.
- Detector ownership is now narrower:
  - detectors read the profile and emit atomic candidates only when the relevant primitive reaches `candidate`,
  - route detectors emit behavior-backed route labels only when the profile marks a behavior candidate; baseline-only candidates stay owned by the personal-baseline detector,
  - weak/observed primitives remain inspectable through diagnostics instead of being dropped silently,
  - `session_fragmentation` additionally requires actual session facts before detector emission, so a baseline-only anomaly can stay diagnostic without becoming a concrete session-shape claim.
- Requirement ownership is the next safety gate:
  - profile-backed labels that carry `evidenceStatus` must be at least `candidate`,
  - direct layer tests/tools without a profile can still validate against the older evidence requirements,
  - the normal evaluation path carries `primaryEvidenceProfiles.checking` so diagnostics can explain rejected or suppressed labels.
- Calibration remains a final label-burden and sensitivity layer. It should tune confidence, sample burden, visibility, and copy without redefining the low-level counter authority.
- `quick_return_loop` is now calibrated as shadow evidence. It can strengthen or explain a composite, but it should not be presented as a standalone habit claim.
- `checking_carousel` treats quick return as an enhancer, not a mandatory component. The habit-shaped core is switch churn plus at least two supporting signals from distributed visits, short sessions, visit pressure, and quick-return impulse.

### Counter Authority Path

Current high-density checking counters are not recomputed from raw logs at analysis time. They are event-time aggregate counters with compact hourly/day storage:

| Counter family | Increment owner | Increment timing | Downstream consumer |
| --- | --- | --- | --- |
| visit re-entry (`revisitWithin10m`, gap buckets) | `statsAggregator.incrementDomainVisit()` | domain visit event, comparing `now` with `behavior.lastVisitAt` | facts behavior, temporal evidence, checking/re-entry profile |
| switch-back re-entry (`switchBackWithin10m`, gap buckets) | `statsAggregator.recordDomainSwitch()` | domain switch event, comparing `now` with target domain `behavior.lastExitAt` | quick-return and route-loop profile |
| short sessions (`sessions.shortCount`) | `statsAggregator.incrementDomainSession()` | session close/flush, comparing duration with the 2-minute short-session threshold | session fragmentation profile |
| tab entry/context (`newTabEntrances`, `duplicateTabEntrances`, `highOpenTabEntrances`, max tab counts) | `statsAggregator.recordDomainTabContext()` | tab context observation/entrance | new-tab, duplicate-tab, and tab-hoarding profile |

The sequence is:

1. Runtime/collector calls a stats aggregator mutation at the event boundary.
2. `statsAggregator` updates the canonical day-domain counters and hourly counter arrays.
3. `statsBucketMaterializer` and projection/read paths preserve those counters into day/hour buckets.
4. `buildSitePullFacts()` normalizes them into public facts.
5. `buildSitePullCheckingEvidenceProfile()` converts facts into `absent/observed/weak/candidate/strong`.
6. Detectors emit only candidate-or-strong atomic signals.
7. Requirements, calibration, composite composition, and presentation decide what survives as a user-facing badge.

This design is storage-efficient and avoids raw timestamp growth, but it means event order and timestamp authority are critical. If a counter owner changes, the profile `counterAuthority` map and this audit must change with it. Future raw-log or model-parser work should treat these counters as compressed facts, not as lossless event history.

## Threshold Audit Matrix

2026-06-22 implementation:

- Added `sitePullPatternThresholdAudit.js` as the central threshold/bucket matrix.
- The matrix keeps threshold surfaces comparable across layers:
  - collection compression thresholds, such as re-entry buckets and short-session counters,
  - scoring curves, such as `smooth01` ranges for time pressure, checking loop, trend, and circadian risk,
  - evidence-status thresholds, such as `weak/candidate/strong`,
  - requirement and calibration gates,
  - presentation visibility policy.
- The report exposes:
  - rows per pattern,
  - flattened threshold rows,
  - counts by stage, shape, and gate type,
  - review queues for hard label cuts, wide bucket intervals, explicit concerns, missing specs, and presentation-only/supporting labels.
- This is not a claim that current numbers are final. It is the management surface for comparing curves, checking relative strictness, and deciding where a threshold should move:
  - if a rule is a storage-compression boundary, copy must avoid exact behavioral claims,
  - if a rule is a label-candidate gate, it should either have a companion scoring curve or a clear reason for being a hard gate,
  - if a bucket is wide, later UI/model copy should describe it as coarse interval evidence.
- Architecture CI now requires the threshold audit export and verifies that high-risk primitives such as re-entry gap buckets and session-fragmentation status thresholds remain in the matrix.

## Atomic Pattern Matrix

### State Patterns

| Pattern | Current detector basis | Missing-info behavior | Audit verdict |
| --- | --- | --- | --- |
| `no_activity` | `featureVector.hasAnyActivity === false`, with evidence for today usage, visits, weekly usage, active days, and `stateReason=no_activity` | Short-circuits downstream detectors and becomes the only badge | Sound. Keep exclusive state behavior. This is a deferred-judgment state, not a positive health claim. |
| `insufficient_data` | Overall confidence `< 0.35` while activity exists, with confidence threshold/gap and sparse-data `stateReason` evidence | Emits one neutral data state, then other detectors can still run | Improved. This is a data-quality caveat, not a behavior claim, and the empty case remains owned by `no_activity`. |
| `steady` | Added only by collector when no detector emits anything, with `stateReason=no_detector_patterns`, `detectorSignalCount=0`, usage sample, and confidence evidence | Requires activity context, sufficient model confidence, collector-owned empty-detector evidence, and no other final pattern | Improved. This is a constrained fallback state, not a broad health certificate. |

### Plan / Goal Patterns

| Pattern | Current detector basis | Missing-info behavior | Audit verdict |
| --- | --- | --- | --- |
| `goal_exceeded` | Goal exists and `usageRatio >= 1`, with plan evidence carrying today usage, goal size, overrun, active days, and over-limit days | No goal or no usage means no signal | Sound. Requirement matches detector reasonably well. |
| `goal_missing` | Protected target has activity but no goal, with evidence for protected state, activity sample, today usage, visits, weekly usage, and active days | Not emitted outside protected targets or without activity | Improved. This is a setup-gap context label, not a plan-failure claim. |
| `goal_kept` | Goal exists, `usageRatio < 0.75`, and progress is meaningful enough to avoid tiny accidental opens | No goal, zero/tiny usage, or high usage means no signal | Improved as a positive state. A very small open no longer becomes a success badge. |

### Usage / Time / Immersion Patterns

| Pattern | Current detector basis | Missing-info behavior | Audit verdict |
| --- | --- | --- | --- |
| `time_heavy_today` | Time-pressure evidence profile: visible channel from model score, absolute duration, weekly lift, or goal-overrun duration | Without usage facts no signal; weak weekly/goal/personal context is carried as caveats, not a silent fallback | Visible primary badge. It explains total time pressure and exposes which channel made the claim, not absorption, session shape, or personal-baseline anomaly. |
| `personal_spike` | Personal baseline profile: confidence, robust time anomaly score, minimum meaningful duration, and at least one relative-lift / robust-z / p90-breach channel | Sparse baseline produces no signal; forming baselines require a stronger anomaly score | Improved. It means “unusual for you,” and should dominate generic time pressure unless the time label is specifically goal-overrun backed. |
| `deep_immersion` | Immersion evidence profile: sustained block shape plus feed-continuity, navigation-continuity, or exit-resistance support channels | Without hourly/session shape or behavior/navigation/intervention support no direct signal | Represents absorption-backed sustained consumption rather than raw long-session depth. Feed counters are supporting evidence, not sole authority, and support channels are exposed for explanation. |
| `session_depth_spike` | Session-depth evidence profile: baseline confidence, anomaly score, clear/extreme status, and at least one relative-depth / robust-z / p90-breach / long-session-rate / absolute-depth channel | Sparse/missing measured sessions usually no signal | Shadow by default. Keep as recap/detail/supporting evidence for “one session was unusually deep” rather than a primary daily badge. |

### Checking / Re-entry / Route Patterns

| Pattern | Current detector basis | Missing-info behavior | Audit verdict |
| --- | --- | --- | --- |
| `checking_pattern` | `subscores.checkingLoop >= 0.4` when visit facts exist | Without visit facts detector uses proxy ID instead | Useful neutral/context label. Should often remain visible only when no stronger composite exists. |
| `checking_pattern_proxy` | `subscores.checkingLoop >= 0.55` without visit facts | Uses hourly spread/usage shape only; lower confidence | Risky if presented like a concrete checking claim. Treat as provisional/supporting unless no better evidence exists. |
| `visit_spike` | Personal visit confidence `>= 0.35` and anomaly `>= 0.65` | Sparse baseline or low visit evidence produces no signal | Sound as neutral context. Often better as supporting evidence for `checking_carousel` than a primary badge. |
| `reentry_spike` | Personal revisit confidence `>= 0.35` and anomaly `>= 0.55` | Missing revisit facts or sparse baseline produces no signal | Sound, but should remain negative only when revisit facts are real enough. |
| `quick_return_loop` | Either baseline quick-return anomaly or behavior facts: weighted switch-back impulse from `reentryGapBuckets`, switch-ins, weighted return rate | Missing behavior facts can still be baseline-backed; duplicate source is first-wins. When exact switch buckets exist, 0-2m and 2-5m returns carry more weight than 5-10m returns. | Shadow/supporting evidence. It can raise confidence for checking or route composites, but should not become the final user-facing habit claim by itself. |
| `switch_churn_loop` | Either baseline switch-churn anomaly or behavior facts: switch-ins + switch-outs relative to entrances | Missing behavior facts can still be baseline-backed; duplicate source is first-wins | Same as quick-return. Good component, but source arbitration should improve. |
| `domain_pair_loop` | Route-pressure evidence profile: top protected-domain pair count, return share, and pair concentration | Missing transition facts means no signal | Shadow evidence. It means “this domain is repeatedly adjacent to another protected domain,” and supports route composites without becoming a final user-facing habit claim by itself. |
| `protected_route_return` | Route-pressure evidence profile: incoming edges to this target, fast return count/rate, route channel IDs, and route status | Missing transition facts or no target-directed incoming return means no signal | Improved. This is the concrete visible claim for “left and came back to this protected target through another protected route.” |
| `loop_route_hint` | Route-pressure evidence profile rollup: today edge count, distinct protected-domain edges, return pressure, weekly route context, and route channel IDs | Missing transition facts or insufficient distinct route edges means no signal | Improved. Keep as a composite/supporting explanation, usually suppressed when `protected_route_return` is the clearer user-facing label. |

### Navigation / Tab Context Patterns

| Pattern | Current detector basis | Missing-info behavior | Audit verdict |
| --- | --- | --- | --- |
| `habitual_entry` | Navigation intent metrics: conservative direct-entry count `max(typed,addressBar)+keyword`, safe denominator, and stepped repeat/share alternatives | Missing navigation facts means no signal | Improved. Avoids double-counting address-bar qualifiers while still catching repeated direct invocation at moderate share. |
| `reload_checking` | Navigation intent metrics: reload count, safe denominator, and stepped repeat/share alternatives | Missing navigation facts means no signal | Improved. Good concrete checking signal; two reloads can be candidate only when they dominate a small navigation sample. |
| `new_tab_loop` | Tab-context evidence profile: new-tab entry support from new-tab entrances and entry share | Missing behavior facts means no signal | Shadow/support only. New tabs alone are ambiguous. |
| `duplicate_tab_entry` | Tab-context evidence profile: same-domain tab support from duplicate entrances and max same-domain open tabs | Missing behavior facts means no signal | Shadow/support only. Useful as a component of `tab_queue_pattern`. |
| `tab_queue_pattern` | Tab-context evidence profile: same-domain tab queue from new-tab, duplicate-tab, same-domain-open, and browser-wide tab context channels | Missing behavior facts means no signal | Primary user-facing tab label. It means “this site was being handled as a tab queue,” not merely “you opened a new tab.” |
| `tab_hoarding_context` | Tab-context evidence profile: browser-wide open-tab context | Missing behavior facts means no signal | Shadow/support only. Browser-wide tab load is not site-specific enough for a standalone claim. |
| `background_residency` | Background residency evidence profile: overlap-safe media/linger/stale pressure, today + weekly context, domain-level background dedupe | Missing background behavior facts means no signal | Useful for “left open in the background” feedback. Same-domain background tabs must not multiply duration; overlapped media/linger/stale channels are pressure evidence, not additive time. |

### Content Flow / Feed Patterns

| Pattern | Current detector basis | Missing-info behavior | Audit verdict |
| --- | --- | --- | --- |
| `feed_skimming` | Content-flow evidence profile: skim support from feed skim signals, item transitions, and screenfuls | Missing behavior/content-flow facts means no signal | Shadow/support only. Too ambiguous as a standalone user-facing label. |
| `feed_loop_pattern` | Content-flow evidence profile: feed supply/loading, skim, scroll velocity, and feed pressure/interrupt channels; visible only with multi-channel confirmation or strong supply | Missing behavior/content-flow facts means no signal | Primary user-facing feed label. The “feed loading” signal is `feedSupplyScore`, not a separate badge. |
| `fast_scroll_bursts` | Content-flow evidence profile: scroll velocity support from fast scroll and scroll spike bursts | Missing behavior/content-flow facts means no signal | Shadow/support only. Fast scroll alone should not imply intent. |

### Habit / Trend / Circadian / Intervention Patterns

| Pattern | Current detector basis | Missing-info behavior | Audit verdict |
| --- | --- | --- | --- |
| `daily_habit` | Habit-consistency evidence profile: active days, streak, volume consistency, visit regularity, peak habit window, and pressure/checking context | Without weekly facts or at least 4 active days no visible label; low-volume and pressure/checking contexts are caveats | Improved. It remains a neutral habit atom, while pressure/checking meaning is left for context/composites. |
| `rising_trend` | Trend-pressure evidence profile: the canonical Site Pull trajectory compares the recent 7-day mean and 3-day momentum with the prior/p75 personal reference, with a single-day spike caveat | Sparse history or single-day spike-like shape suppresses the visible label; profile still records caveats for diagnostics | Improved. It now means “recent flow is rising,” not merely “today is high.” |
| `late_night` / `late_night_binge` | Night-pressure evidence profile: fixed night/core-late windows, night duration/share, visit spread, weekly night reference, duration context, and cycle-position proxy caveat | No hourly data or no night usage means no signal; without visit/weekly context the label can still emit but carries caveats | Improved. `late_night` is an observed circadian-context atom; `late_night_binge` is only visible when night pressure has duration/recurrence/context support. |
| `intervention_reentry` / `intervention_resistance_loop` / `intervention_recovery` | Intervention-outcome evidence profile: today/weekly friction windows, selected re-entry window, repeated re-entry pressure, today leave-without-reentry recovery, and filtered effect summary | No intervention facts means no profile signal; filtered effect facts use resistance-eligible counters for resistance labels while raw/effectiveness/excluded summaries stay available for diagnostics | Improved. Re-entry, resistance-loop, and recovery labels now share one outcome interpretation instead of each detector rereading intervention facts differently. |

## Highest-Risk Gaps

1. Requirement layer is not yet strict enough for subscore-backed atoms.
   - A detector threshold can be true in normal flow, but direct `buildSitePullPatternLayers()` input can pass with only weak evidence.
   - Affected: `time_heavy_today`, `deep_immersion`, `daily_habit`, `rising_trend`, `late_night`, `steady`.

2. Duplicate-source arbitration is first-wins, not evidence-aware.
   - Baseline detectors run before behavior detectors.
   - A repeated ID can keep the weaker or less current source.
   - Affected: `quick_return_loop`, `switch_churn_loop`, and possibly future IDs.

3. Proxy/context patterns need explicit presentation intent.
   - `checking_pattern_proxy`, `new_tab_loop`, `duplicate_tab_entry`, `tab_hoarding_context`, `feed_skimming`, and `fast_scroll_bursts` are useful evidence, but can feel overinterpreted as primary user-facing labels.
   - Feed-flow now keeps `feed_skimming` and `fast_scroll_bursts` as shadow support and presents `feed_loop_pattern` as the single visible label when feed supply/loading, skim, scroll velocity, or pressure channels confirm each other.
   - Tab-context now keeps `new_tab_loop`, `duplicate_tab_entry`, and `tab_hoarding_context` as shadow support and presents `tab_queue_pattern` when same-domain tab queue evidence is confirmed.
   - These should either be supporting-only or have softer copy/priority rules.

4. Missing-data semantics are implicit.
   - Most detectors simply emit nothing when facts are absent.
   - This is good for avoiding false positives, but diagnostics do not yet say "not judged because navigation facts unavailable" or "not judged because behavior facts off."

5. Positive/contextual pattern calibration is still thin.
   - `goal_kept`, `steady`, `controlled_brief_check`, and `intervention_recovery` now exist as positive distinctions.
   - `focused_block` is contextual: it records a sustained domain block, then presentation decides whether that block reads as stable focus, neutral sustained use, or risk-backed immersion.
   - Remaining risk is calibration against real local distributions, not absence of positive labels.

## Scenario Shadow Matrix

2026-06-22 implementation:

- Added `sitePullPatternScenarioMatrix.js` as a diagnostic-only scenario matrix.
- `patternDiagnostics.shadowReport` maps actual pattern-layer output to scenario rows without changing user-facing badges.
- Each scenario records:
  - the pattern IDs that can satisfy it,
  - expected visible pattern IDs,
  - required data families,
  - status: `matched_visible`, `matched_suppressed`, `missing_data`, or `not_observed`,
  - conflict groups for mutually suspicious visible interpretations.
- Initial scenarios:
  - `controlled_brief_check`
  - `focused_block`
  - `checking_carousel`
  - `route_return_loop`
  - `feed_loop`
  - `late_night_binge`
  - `intervention_resistance_loop`
  - `intervention_recovery`
  - `goal_overrun`
  - `no_activity`
- Stats Pipeline Diagnostics Lab compact output now carries a `sitePull.shadow` summary so shadow results can be copied/debugged without adding user-facing UI.

## Temporal Evidence Layer

2026-07-12 canonical contract:

- `sitePull/temporalEvidence.js` is the shared current temporal-facts layer for site-pull profiles.
- `computeSitePullProfile()` now returns `temporalEvidence`, and `buildSitePullFacts()` includes it in public facts.
- Version 2 exposes today's active/visit/hour context and compact explanation strings, but no personal-baseline or direction window.
- `buildSitePullRecentTrajectory()` is the sole Site Pull direction producer. Its canonical DTO owns prior-vs-recent and momentum/reference ratios, dispersion/volatility, exact comparison/active-day counts, recent total, previous recent maximum, today's recent-window share, and the single-day-spike guard.
- The retired temporal-layer `recent3d`, `recent7d`, linear `weighted7d`, baseline window, weighted ratio, and robust trend z-score must not return. Trend-pressure evidence consumes the canonical trajectory plus the canonical active-time metric stats/anomaly.
- The temporal layer also standardizes current high-value behavior summaries:
  - `reentryIntervalProfile` from compressed reentry gap buckets when present, with current threshold counters as the weaker summary,
  - `backgroundResidencyProfile` from overlap-safe background media/linger/stale facts,
  - `tabBurstProfile` from tab context facts,
  - `inDomainNavigationDensity` from navigation facts,
  - `cyclePositionProxy` from hourly active/visit buckets.
- release V1 stats schema includes compressed visit/switch reentry gap buckets (`0-2m`, `2-5m`, `5-10m`, `10-30m`, `30-120m`) so the engine can analyze interval shape without storing raw timestamp samples.
- Exact reentry interval quantiles, grouped tab bursts, and cycle-anchored first/tail entry timestamps remain future collection upgrades. The current profile records this limitation explicitly instead of pretending threshold-only counters are exact interval data.
- `backgroundMediaMs`, `backgroundLingerMs`, and `staleTabMs` were already collected/projection-safe; site-pull read/facts normalization now passes them through so the analysis layer can actually use them. These channels can overlap, so user-facing residency duration uses `max(channel)` while `backgroundPressureSignalMs` preserves the summed pressure signal for diagnostics.
- Background tab settlement is domain-deduped before duration is applied. If two inactive tabs for the same hostname exist, the engine records one background residency interval for that hostname while preserving aggregate pressure such as “any tab was audible” and the earliest last-active time.
- Stats Pipeline Diagnostics Lab compact output now carries `sitePull.temporal` with weighted/baseline/reentry/background/cycle-proxy summaries.

## Patch Queue

Recommended order before adding many new labels:

1. Add requirement helpers for data-family coverage and subscore thresholds.
   - Examples: `requiresSubscore('timePressure', 0.7)`, `requiresHourlyFacts()`, `requiresWeeklyCoverage()`, `requiresBehaviorFacts()`.
   - 2026-06-21 initial pass: implemented source-family and subscore threshold checks in `sitePullPatternRequirements.js` for current atomic/state labels.

2. Harden state-pattern requirements.
   - `steady` should require a collector-generated reason such as `source=rule` plus no negative/neutral detector signals in context.
   - `insufficient_data` should optionally suppress weak atoms or carry clearer diagnostics.
   - 2026-06-21 initial pass: `steady` now requires `source=rule` and activity context; full empty-detector context remains future work.
   - 2026-06-24 state pass: `insufficient_data` now carries sparse-data diagnostics, and `steady` requires the collector fallback marker plus an empty final pattern index.

3. Replace first-wins dedupe with source arbitration or evidence merge.
   - Prefer behavior facts for current-day concrete evidence.
   - Preserve baseline evidence as supporting context.
   - Record merged source list in diagnostics.
   - 2026-06-21 pass: detector collection now lets duplicate IDs reach the layer, duplicate signals merge by source/confidence/score, and diagnostics/badges can expose `sourceList` plus `mergedSignalCount`.

4. Add missing-data diagnostics.
   - For each detector family, expose a compact "skipped because no X facts" reason in `patternDiagnostics`.
   - This should remain diagnostic-only and not become user copy.
   - 2026-06-21 pass: `patternDiagnostics` now includes `dataFamilyDiagnostics` and `missingDataDiagnostics`, with skipped pattern IDs, required signals, and permission keys for precision families.

5. Reclassify context atoms.
   - Mark `checking_pattern_proxy`, `new_tab_loop`, `duplicate_tab_entry`, `tab_hoarding_context`, `feed_skimming`, and `fast_scroll_bursts` as supporting/context unless no composite or concrete atom exists.
   - 2026-06-21 pass: these IDs now use a supporting presentation slot; supporting atoms are suppressed behind primary same-group badges while remaining visible in diagnostics.
   - 2026-06-22 pass: visibility intent moved into central calibration specs, so supporting/shadow policy can be tuned without editing detector files.

6. Add golden negative fixtures.
   - No behavior facts means no tab/feed labels.
   - No navigation facts means no habitual/reload labels.
   - Sparse baseline means no personal anomaly labels.
   - Long focused block should not surface checking proxy.

7. Tune calibration thresholds against real local traces.
   - Compare false-positive risk by sensitivity family.
   - Decide whether `evidenceStrength` should stay generic or become family-specific.
   - Keep threshold exceptions centralized in calibration specs, not detector branches.

2026-07-12 reliability pass:

- `checking_carousel` no longer counts aliases from the same primitive as
  independent corroboration. Short-session candidate/repetition, reload
  candidate/repetition, and distributed-visit/visit-pressure pairs each count
  as one evidence family.
- Current-fact composition requires two independent families among attention
  switching, entry distribution, session shape, navigation intent, and route
  transition. A single strong reload or short-session family remains an atomic
  explanation rather than being promoted to a carousel.
- Duplicate atomic IDs retain merged provenance for diagnostics, while the
  selected concrete source owns score and confidence; a secondary baseline
  signal can no longer inflate the current detector result through `max()`.
- Composite confidence uses a weakest-component-aware blend with a bounded
  corroboration lift instead of inheriting the single highest component.

## Next Design Targets

After the hardening queue above, the best atomic-pattern additions are:

- controlled brief check: positive/neutral, visit facts + low dwell + no reentry.
- focused block: contextual sustained domain block, measured session or hourly shape, interpreted by stability/drift/checking/context risk.
- session fragmentation: negative, many short sessions without necessarily high total time.
- intervention recovery: positive, friction shown followed by leave/no fast reentry.
- repeated reload check: already present, but can become a component of a stronger checking composite.
- protected-site route return: stronger version of `domain_pair_loop` when top edges repeatedly lead back into the protected domain.

2026-06-21 implementation note:

- Added initial `focused_block`, `session_fragmentation`, and `intervention_recovery` atomic patterns using only local usage/session/behavior/intervention summaries.
- The initial `focused_block` implementation used low-switching evidence when behavior facts existed and stricter concentration when they did not; the 2026-06-23 pass replaces that with a contextual sustained-block profile.
- `session_fragmentation` is also a supporting component of `checking_carousel`, so a carousel can explain the short-session shape without creating a redundant visible badge.
- `focused_block` keeps `category=immersion` for analysis but uses the `focus` presentation group; presentation policy now decides whether it or an immersion-risk badge is the better visible explanation.

2026-06-23 implementation note:

- `focused_block` now represents a contextual sustained-domain-block atom rather than an always-positive label.
- Intervention labels now consume `sitePullInterventionOutcomeEvidenceProfile`: `intervention_reentry` is a selected-window re-entry atom, `intervention_resistance_loop` is the composite of repeated re-entry plus loop context, and `intervention_recovery` is today leave/no-reentry evidence blocked by any re-entry pressure.
- The same profile carries filtered effect-summary evidence (`resistanceEligible`, `effectivenessEligible`, excluded counters, top re-entry/exit artifacts) so later recaps/model inputs can explain which intervention classes or artifacts worked without changing the label path.
- Added a sustained block evidence profile with `sustainedBlockMs`, `blockShare`, `stabilityScore`, `driftScore`, `checkingPressureScore`, `contextRiskScore`, and `blockInterpretation`.
- Presentation suppresses raw `deep_immersion` when a stable focused block is the better visible explanation, and suppresses `focused_block` when time-heavy, checking, late-night, intervention, or raw immersion warnings better explain the same block.
- `session_depth_spike` is retained as shadow evidence: it can support composites and future recap/detail copy, but it should not compete with primary badges in the default rules surface.
- `late_night` and `late_night_binge` now share a night-pressure evidence profile. It uses fixed night/core-late windows today, records that caveat explicitly, and includes the existing hourly cycle-position proxy until cycle-state wake/sleep context is promoted into site-pull facts.
- `rising_trend` now uses a trend-pressure evidence profile. The visible label requires recent multi-day or personal-baseline trend support and records `single_day_spike_like` as a caveat instead of treating one high day as a trend.
- `daily_habit` now uses a habit-consistency evidence profile. The label means “this site is a regular touchpoint,” with `high_pressure_context` or `checking_context` recorded as caveats rather than changing the atom into a negative label.
- `controlled_brief_check` now uses a controlled-brief evidence profile. The label means “brief use with quiet pressure context,” so checking pressure, route-return pressure, time pressure, or known re-entry prevents the positive badge rather than merely lowering the score.
- `controlled_brief_check` now separates observed brevity from stronger quiet-control evidence. Missing behavior/route/intervention context can still present a softer brief-check badge, but the evidence status only becomes `controlled_brief_check` when quiet-context coverage is available.
