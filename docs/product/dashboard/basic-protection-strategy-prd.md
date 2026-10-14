# Basic Protection Strategy PRD

- Status: Active
- Owner: protection domain / Basic strategy
- Last validated against code: 2026-07-12
- Path policy: current-only
- Canonical for: Basic recent-usage trajectory, target recommendation, and effective-target semantics
- Companion to:
  - `docs/architecture/repository/personal-baseline-boundary-map.md`
  - `docs/product/dashboard/basic-mode-automatic-protection-prd.md`
  - `docs/product/dashboard/basic-strategy-orchestrator-prd.md`

## Product Contract

Basic protection starts from the target the user declared. Personal usage may
produce a reviewable recommendation, but it never silently weakens, replaces,
or writes that target.

```text
stats date/domain active facts
  -> exact previous seven completed calendar days
  -> recent_trajectory DTO
  -> adaptive_reference recommendation DTO
  -> explicit user review

declared target
  -> effective target used by protection
```

The two paths have different authority. The recommendation path is advisory.
The declared-target path controls runtime protection.

## Canonical Owners

| Concern | Owner |
| --- | --- |
| Completed-day date window and fact adapter | `src/domains/protection/domain/basicProtectionRecentTrajectory.js` |
| Exact trajectory/recommendation contracts | `src/domains/protection/strategy/contracts/basicStrategyContextContract.js` |
| Recommendation bands and named defaults | `src/domains/protection/strategy/catalog/basicStrategyPolicy.js` |
| Runtime context assembly | `src/domains/protection/domain/protectionRuntimeDecision.js` |
| Basic strategy enforcement | `src/domains/protection/background/strategy/BasicStrategyOrchestrator.js` |
| Strategy normalization and snapshot transport | `strategyContracts.js`, `protectionRuntimeSnapshotBridge.js` |

The general popup usage-summary utility is not the Basic trajectory owner. It
may retain its own presentation semantics without becoming a second Basic
policy implementation.

## Recent Usage Trajectory

The versioned DTO is `basic-protection-recent-trajectory-v1` with
`role=recent_trajectory` and `grain=day`.

- The window is exactly the previous seven completed local calendar days.
- The current partial day is excluded from this trajectory.
- An absent date is `observed=false`, `activeMs=null`.
- A present date with no matching domain is an observed domain zero:
  `observed=true`, `activeMs=0`.
- A present matching domain must carry a finite, non-negative numeric `active`
  fact. A malformed day, domains map, or active fact is a contract error.
- `averageDailyMs` uses observed days as its denominator. It is `null` when
  there are no observed days; missing days are never imputed as zero.
- Status is `sparse` for 0-2 observed days, `forming` for 3-6, and `stable` only
  when all seven days are observed.

The DTO carries exact version, role, grain, status, provenance, window,
evidence, average, and per-day observations. Unknown fields or contradictory
relations fail at the contract boundary.

## Target Recommendation

The versioned DTO is `basic-target-recommendation-v2` with
`role=adaptive_reference`.

The recommendation anchor is the greater positive value of the completed-day
observed average and today's partial usage. The named policy bands are:

| Anchor | Recommendation |
| --- | --- |
| no positive usage evidence | normative default: 30 minutes |
| below 20 minutes | 15 minutes |
| 20 to below 45 minutes | 85% of the anchor |
| 45 to below 90 minutes | 80% of the anchor |
| 90 minutes or more | 75% of the anchor, capped at 180 minutes |

Every non-normative candidate is capped at the named
`maxRecommendedTargetMinutes=180`. The DTO carries the uncapped candidate and
`capApplied` together with `recentUsageAverageDailyMs` and
`currentPartialDayMinutes`. The contract re-derives source, mode, uncapped, and capped values
from those inputs rather than trusting transported result
scalars. Runtime strategy and snapshot boundaries additionally require the
transported recent average to equal the exact completed-day trajectory average.

The DTO always declares `normativeDefaultSource=normative_default`,
`requiresUserReview=true`, and `autoApply=false`. With no positive evidence it
uses `source=normative_default` and `referenceMode=normative_only`; otherwise it
names either `recent_usage_trajectory` or `current_partial_day` and uses
`referenceMode=bounded_adaptive`.

Recommendation generation never mutates the site goal. Applying a suggestion
requires the settings-owned review and write flow.

Dashboard URLs carry navigation intent only: Sites tab, selected domain, and
the `reviewGoal` route intent. They never carry recommended or declared minute
scalars. The Rules review surface refreshes the selected site's runtime
snapshot and creates a CTA only from its validated exact recommendation DTO;
URL parsing cannot reconstruct or override recommendation semantics.

## Effective Target And Lifecycle

Basic has one current runtime lifecycle value: `stabilize`.

```text
effectiveTargetMinutes = declaredTargetMinutes
effectiveTargetSource = declared_target
```

There is no acclimation blend, convergence phase, target-weight schedule, or
softened effective target in active Basic policy. Recommendation evidence may
explain a proposed change, but it cannot alter budget pressure or intervention
thresholds before the user accepts that change.

The real-time strategy states remain separate: `observe`, `guide`,
`constrain`, `interrupt`, `recover`, and `lock`. They respond to the canonical
observation, pressure, and direct-trigger contracts; they do not redefine the
target lifecycle.

## Persistence And Failure Policy

- Stats facts remain the historical source of truth.
- Site goals remain settings-owned.
- Trajectory and recommendation DTOs are computed projections; they are not a
  second persisted baseline or goal.
- Missing history produces a sparse trajectory and normative-only
  recommendation.
- Malformed canonical facts, clocks, thresholds, DTO shapes, or relations fail
  loudly. They are not coerced to zero and do not trigger a legacy read.
- Strategy and snapshot bridges preserve the exact trajectory and
  recommendation contracts so downstream consumers cannot reconstruct them
  from compatibility scalars.
- Dashboard and recovery URLs contain no target-minute facts. A missing runtime
  recommendation DTO means there is no recommendation CTA.

## Acceptance Criteria

- Current-day usage never enters the seven completed-day average.
- Missing date and observed domain zero remain distinguishable end to end.
- The observed-day average is `null` with no observations.
- Every Basic recommendation is visibly advisory and review-only.
- The runtime effective target always equals the declared target.
- Retired acclimation/effective-target blending exports and direct-only tests do
  not exist.
