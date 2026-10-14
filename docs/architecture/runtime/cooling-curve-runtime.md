# Cooling Curve Runtime

- Status: Active
- Owner: protection background runtime / protection content runtime / settings domain / platform storage
- Last validated against code: 2026-10-14
- Path policy: planning-allowed
- Canonical for: per-site cooling settings, quantized curve modifiers, background refresh and prepaint parity; proposed P2–P4 ending and interaction extensions are explicitly separated.
- Companion to:
  - [Cooling cycle product note](../../product/dashboard/cooling-cycle-product-note.md)
  - [Feed landing](../../product/landing/feed-landing.md)
  - [Feed-flow runtime](feed-flow-runtime-target-architecture.md)
  - [Intervention admission](intervention-admission-runtime.md)
  - [Furin daily delivery](furin-daily-delivery-policy.md)
  - [Sites and schedule boundary map](../repository/sites-schedule-boundary-map.md)
  - [Friction nudge effect boundary map](../repository/friction-nudge-effect-boundary-map.md)

## 1. Why this design exists

Public naming: the independent periodic control is **Tools -> Barrier ->
Consumption interval** (`소비 간격`). Both classified-click and feed-Horizon
routes belong to Barrier. Retained execution names such as `ensoGate`,
`enso_gate`, `EnsoSpawnPolicy` and `ensoCadencePolicy` describe that runtime;
they do not move ownership back to the Zen Enso artwork, which belongs to Veil.
This design changes no runtime/storage identifier merely for display naming.

The public feed landing shows "끝없는 피드에, 끝을": friction starts in staggered
stages (desaturation ~22%, signal ~42%, blur ~58%, text shuffle ~76% of the
journey; `src/apps/feed-landing/model/frictionJourney.js`), plateaus, and a
declarative Horizon ends the feed. Before P1-C the staged ramp was disclosed as
website-only. P1-C connects enabled extension effects to Site budgets; the
landing's declarative final feed Horizon remains a website presentation.

The implemented curve makes the ramp real in the extension: a per-site time budget drives
a curve. Filters start one at a time and get stronger until the site is hard to
use near the target time. At 100% the curve plateaus and a site-goal end becomes
eligible; actual delivery waits for a safe consumption boundary. It adds no
second usage clock or effect actuator.

Design direction agreed on 2026-10-13: P1 keeps Site Furin; P2 represents one
site-goal end with either Budget Horizon or Furin. A supported feed must present
Horizon before any Site or Global Furin, including when periodic Barrier reflection is OFF.
Periodic Barrier reflection remains an independent intermediate reflection; its lighter
interaction is still a design target. The P1-A shared-boundary implementation is
recorded below along with P1-B policy/receipt/readout and P1-C curve/settings work.
This contract is adopted for the implemented runtime. P1 release evidence and
lighter periodic interaction remain open; P2–P4 remain proposals. §6 and §10
distinguish these from implemented behavior.

### Implementation ledger — 2026-10-13

| Slice | Source implementation / remaining work |
| --- | --- |
| P1-A shared boundary | `FeedBoundaryEpisodeCoordinator` owns one feed consumer/Terminus for periodic or goal demand; Site/Global Furin require Horizon encounter and fresh continuation on supported feeds even with Enso OFF; same goal-kind lease covers both phases; actual boundary exposure and final Furin are separate. |
| P1-A safe entry | Non-feed Furin narrows to classified new-content action with an exact prepared permit. Unknown/unsafe feeds and primary-media contexts without semantic completion proof wait; the standalone-media-end adapter remains unimplemented. |
| P1-A remaining | Lighter periodic interaction, declared per-surface/media coverage and required runtime/browser verification remain phase exit work; a new shared owner does not certify all sites or the complete screen matrix. |
| P1-B goal policy | Global -> Site -> periodic new selection, immutable goal/day/profile/document binding, fenced privileged-transition revalidation, and exact `entry_cancelling` cleanup ownership are implemented. New periodic grants recheck actual eligible goals; existing ordinary owners are preserved. |
| P1-B records/readout | V2 daily `siteEnds`, actual-only combined Global delivery, brief later Site Furin, incompatible V1 rejection/reset boundary, and passive host/day `goalEndSummary` in Filter status are implemented. Deterministic owner tests do not certify real-site rendering or close-goal interaction quality. |
| P1-C curve/settings | The exact `coolingCurve` setting replaces `globalFrictionLevel`; the public Settings Protection preset, four Tools family modes and nullable advanced storage use typed commands. Filter retains a development-only readout. The background-only 16-step resolver replaces Site budget strengthening for controlled curve children; fixed/excluded/OFF children retain their contracts. |
| P1-C prepaint/refresh | Runtime/envelope V2 and bootstrap carry the same quantized curve and modifiers. Existing minute tracking ingress refreshes same-host tabs only on curve state changes; unchanged-step freshness renewal uses the existing derived-cache/registration owners without another content message or clock. |
| Public policy UI | Settings Protection owns the preset and independent Site/Global preferences; Tools Furin retains scoped status, prerequisites, temporary pause and the Settings link. Exact `nudgeConfig.goalEnds` replaces stored master activation; candidate, signature, priority, readout, preset and Guidance owners use the same preferences. |
| P1 release and P2–P4 | Per-surface/experience evidence and lighter periodic UI remain P1 exit work. Capability-selected Horizon-only goal ending, the advanced editor and hard-stop/Shishi options remain proposals. |

P1-C verification on 2026-10-13: 47 affected test files / 1,167 tests passed,
followed by 62 policy-context/dispatch tests and 161 tests covering the final
strict bootstrap bridge correction (the latter overlaps the affected set).
`build:prod` and its bundle/worker/content closure checks passed. Cooling,
storage, versioning, dashboard, kernel, bootstrap, generated background locale,
release-baseline and documentation guards passed. That pass reported two
pre-existing dynamic keys in `ZenArtifactSwitchBand.jsx`; explicit static action
keys resolved them on 2026-10-14, with i18n contract/ownership guards and five
existing control-flow tests passing.
These are synthetic/unit/build results; no P1-C real-site or human QA PASS is
claimed, and the release evidence gates below remain open.

Public policy UI verification: 39 affected test files / 780 tests and final
`build:prod` passed. The Settings capture target now admits an explicit section.
Headless Korean Protection capture
`20261013145640872-dashboard-capture-7c5252ee` passed with clean page logs and
complete cleanup; its screenshot was inspected. The final compact preset layout
passed headless Korean desktop (1784×849) and narrow portrait (560×960) captures
on 2026-10-14: `20261013155109251-dashboard-capture-708f9645` and
`20261013155926638-dashboard-capture-bf8ae8bd`, both using build
`20261013155230-ee382e469a53-dirty`. Their images were inspected; page errors,
warnings and CSP violations were zero, and all seven cleanup owners released.
The portrait run additionally verified the expanded policy/Barrier link,
horizontal bounds and exact disclosure/scroll restoration without settings
writes. Its preceding run failed the existing first-frame wait budget; an
unchanged rerun passed after parallel checks completed. Ten focused capture
tests and the QA architecture guard passed. This closes final-layout/portrait
screen QA, not real-site goal-delivery or P1 release-experience gates.

Historical real-site QA on 2026-10-14 found an attainment-basis inconsistency.
Owned headless run `20261013171748192-consumption-goal-ends-38d6def3` recorded and
durably read 177,787 ms of TikTok activity, with three successful minute ticks,
native active/idle admission and complete 7/7 cleanup. Sites protection charge
and Global exposure nevertheless remained zero. `projectStatsDay.js` classifies
each hourly bucket against `siteRuleTimeline` at the hour's start; a rule added
later in that hour leaves its post-registration activity classified as `other`.
`statsSitesRegistryReadModel.js` counts only `blocked` buckets, while
`ProtectionRuntimeInputAssembler.js` reads per-domain active time for Site
curve/Furin and `ProtectionRuntimeInputProvider.js` reads blocked totals for
Global. That implementation did not satisfy the shared-attainment promise in §3.2.
Substituting an observed-time QA reader or backdating the
rule is not verification. Full real-site Horizon-to-Furin, close-goal and
cancellation assertions remain unverified beyond this prerequisite failure.
The fully permissioned reproduction
`20261013173008974-consumption-goal-ends-5b162546` confirmed the same discrepancy:
119,435 ms observed after canonical enrollment, an `other` current-hour bucket,
zero Site charge/Global exposure, and complete 7/7 cleanup. It fails explicitly
with `QA_GOAL_END_REAL_SITE_POST_REGISTRATION_CHARGE_DIVERGENCE`. Its activity-day
identity comes from `registryDay.range.startDateStr`, not the DTO's calendar date.
The subsequent V2 recorded-charge cutover (§3.2) replaces these goal readers and
the hour-category-derived budget path. Focused storage, boundary and consumer
verification is separate from the fresh real-site acceptance run.
The V2 rerun `20261013230843627-consumption-goal-ends-8f30dc69` booted the
development build headlessly but stopped before recording: native Windows
`idleState=idle` and `Tab.audible=false` left the ordinary Tracking source
unavailable. It is BLOCKED, with complete 7/7 cleanup;
it certifies no goal-delivery assertion. No headed retry or synthetic idle/time
state was used. Final source build `20261013230639-16b15330ac57-dirty` includes
the canonical-hydration deadlock fix and passes development artifact
closure checks. Focused boundary/settings (303), storage (145), query and runtime
consumer checks cover the source cutover; real-site goal acceptance remains open.

The QA browser management fix is independently verified: headless
`settings/concurrency` run `20261013170033330-settings-concurrency-ef559420` and
`video-skip/native-controls` run `20261013165435070-video-skip-native-controls-769feac3`
passed with complete cleanup while independent goal QA was running. An artifact
admission conflict waited 2.4 seconds and proceeded automatically. These results
certify their own scenarios and browser/resource handling, not goal delivery.

See [Feed-flow runtime](feed-flow-runtime-target-architecture.md) and
[Intervention admission](intervention-admission-runtime.md) for implemented
ownership and phase accounting. P1-A source changes alone do not satisfy the
complete P1 launch gate in §9.

P1-B verification: 40 focused test files / 754 tests and `build:prod` passed,
along with intervention, friction, nudge-owner, storage, versioning and document
guards. These are synthetic/runtime-owner checks; browser/site/restart experience
QA remains pending. P1-B reported stale snapshot blur-strength and feed-only
trigger expectations; P1-C aligned those fixtures with the unchanged canonical
visual and Gate/Feed owners. The then-open dynamic translation-key contract in
`src/themes/plugins/zen/widgets/tools/ZenArtifactSwitchBand.jsx` was closed on
2026-10-14 as recorded above.
No development profile was reset.

## 2. Baseline before P1-C (verified 2026-10-13)

A budget-driven escalation path already exists. The curve has to replace parts of
it, not sit beside it:

| Existing piece | Owner | What it does today |
| --- | --- | --- |
| Per-site goal | `siteGoals` in `settings.rules` (`normalizeSiteGoals`, `src/domains/settings/config/siteRules.js`), edited by the Sites cap editor | Positive integer minutes per normalized domain. A missing goal is an explicit "off" state. Increases are capped at +30 min per edit inside `SettingsService.commitSettingsMutation.prepare`. |
| Site day usage | `projectProtectionBudgetWindow` sums recorded `hourlyProtectedActive`; runtime composition carries `protectedActive` as `domainActivityMs` | Protection-admitted foreground charge for the reset-hour activity day. Sites, curve and Site Furin consume this same fact; observed `active` remains the separate usage statistic. |
| Budget ratio | `src/domains/protection/background/observe/BudgetSnapshotReader.js` | `budgetRatio = siteDayMs / (dailyMinutes × 60 000)`. This is the only budget-ratio computation. |
| Level escalation | `policy/LevelResolver.js` with `catalog/postureProfiles.js` (gentle/balanced/strict thresholds 0.5–0.98) | Turns `budgetRatio` into levels 1–4, then lanes (`laneRecipes.js`) and plan filters (`filterCapabilityCatalog.js`). |
| Effect of a level on user filters | `EnvelopeAdapter.mergePlanFiltersWithBase` | For an adaptive filter that both the user and the plan have active: one `policy_strengthening` modifier (+1 band). At `budgetRatio ≥ 1`: one `target_overrun` modifier (+1 band, source `furin_overrun`). The user's ON/OFF is never overridden. |
| Strength vocabulary | `frictionIntensityBands.js` (relaxed/normal/reinforced, delta −1..+1), `visualFrictionProfiles.js` (`BAND_SCALE` 0.6/1/1.35, integer strengths 0–100) | Lens strengths are integers. Band scaling is the only runtime intensity change. |
| 3-way user choice | Filter tab degree selector (`FilterTab.jsx` → `ProtectionControlSidebar`, copy 부드럽게/균형/엄격하게) writes `globalFrictionLevel` (1–5); `ProfileResolver.mapGlobalFrictionLevelToPosture` maps it to a posture | Effectively already "how early and how hard protection rises". |
| Modifier transport | `frictionModifierResolver.js`, resolved in background (`EnvelopeAdapter`) and content (`ProtectionFrictionModifierRuntime`, `bootstrapEarlyRuntime`) | Operations: `adjust_intensity`, `suspend`. `furin_stay_suspension` is declared vocabulary; it currently has no production emitter. |
| Push cadence | `trackingTickRunner.runAdmittedTick` (existing beat) → `checkGlobalCapStatus`, `maybeTriggerProtectionNudge`; per-tab `ProtectionDispatchSerialQueue`; `ProtectionDispatchStateLedger` payload-signature dedupe | Ordinary refresh re-dispatches only when the payload signature changes. |
| Site goal presentation | Site Furin (`furin-daily-delivery-policy.md`): once per host per activity-day, full/brief, continue/leave | Goal attainment creates eligibility, not an immediate display guarantee. Global covers only an explicitly combined, already-attained current-host goal; later distinct Site ends remain eligible and brief. |
| Feed endpoint | Shared `FeedBoundaryEpisodeCoordinator` with purpose-specific demand and one Terminus | Periodic Barrier reflection retains its cadence; Site/Global Furin independently require the same feed boundary. Horizon-only goal ending remains P2. |
| Furin entry | Shared feed prelude and classified non-feed new-content action | Horizon precedes Site/Global Furin on qualified feeds, even with Enso OFF. Unproved primary-media contexts wait; semantic media-end mode remains future work. |
| Shared intervention lifecycle | `InterventionAdmissionService`, `ensoCadencePolicy.js` | An actually presented automatic Furin ending resets Enso cadence; common recovery is 45 seconds. An attached/displayed ordinary Horizon retains its owner and defers Furin. |
| Global budget and coalescing | `ProtectionRuntimeInputProvider`, `ProtectionRuntimeInputAssembler`, `ProtectionNudgeDispatchContext` | Global is the independent canonical recorded activity-day total. An excluded current host does not erase other hosts' admitted Global time. Only actually attained and unserved current-host goals combine; near-Global substitution is removed. |

So today, once a site is over its budget, friction can only rise by one band in a
single step, and only for children that are already ON. Posture thresholds affect
lane activation, but the user sees no staged onset.

## 3. Progress model

### 3.1 Input

```text
budgetProgress(host, activityDay) = BudgetSnapshotReader.budgetRatio
                                  = siteDayActiveMs / (siteGoalMinutes × 60 000)
```

- **One input.** The existing per-site goal from Sites is the budget. v1 has no
  per-entry target and no separate curve budget.
- **Single owner.** The curve reads `plan.trace.budgetRatio`, which the existing
  `BudgetSnapshotReader` produces. No other module may divide usage by a goal
  (enforced by a guard, §8).
- **Range.** `budgetProgress ≥ 0`. Values ≥ 1 mean the budget is ended, and the
  curve plateaus there.

### 3.2 What counts as time

v1 uses recorded protection charge in the current reset-hour activity day.
The existing foreground collector records `protectedActive` and
`hourlyProtectedActive[24]` only for actual admitted active segments whose
effective protection scope is blocked. `projectProtectionBudgetWindow` is the
single reset-hour projection used by Sites and runtime; observed `active` is
not a goal charge. This corrects the earlier assumption that all consumers
already shared one basis. As a result:

- The Sites notebook's "remaining / over" readout, Site Furin's goal eligibility
  and the curve's 100% use the same attainment fact. A ritual may be delivered
  later at a safe boundary; that delay does not postpone attainment or plateau.
- Only focused foreground time is counted, so opening several tabs of one site
  does not multiply progress. Background audio and blurred windows add nothing,
  following the existing stats semantics.
- Registration at 14:37 charges the admitted interval after 14:37 in that same
  hour. Earlier observation is not charged retroactively, and hour-start category
  classification cannot delay charging until 15:00. Tracking seals the old
  foreground prefix before publishing the new policy in its existing serialized
  stats lane. Goal-value edits do not reset charge.
- Releasing and re-registering protection preserves recorded charge and actual
  delivery receipts. Global sums the same recorded domain facts independently
  of current protected membership; release alone cannot erase its usage. Current
  explicit recording exclusions/consent revocation still govern read admission
  and future collection without deleting the stored facts. Sites and runtime use
  identical most-specific blocked/allowed domain grouping.
- Stats daily/hourly facts use schema V2 with mandatory charge fields. V1 or
  missing fields reject without mutation; no timing, active-total or optional
  interval reconstruction is permitted. DB topology, snapshot envelope and
  independent stats-event schema remain V1. A pre-release old profile requires
  an explicit operator-selected reset; QA uses a fresh owned profile.
- This basis depends on site recording admission. When recording is disabled for
  the domain, there is no basis (§3.5). Barrier's consent-independent operational
  clock (`intervention-admission-runtime.md`) is a different product contract and
  is **not** reused (decision D2).

### 3.3 Resets

| Event | Effect on progress |
| --- | --- |
| Activity-day boundary (reset hour) | Progress returns to 0 through the existing stats date rollover. The next tick sees the step change and re-dispatches. |
| Goal decreased | Ratio recomputed on the settings broadcast. It may jump forward several steps. Allowed: an explicit user act. |
| Goal increased (≤ +30 min per edit, existing cap) | Ratio recomputed. Steps may go down. Allowed: an explicit user act. |
| Goal removed | `no_budget` state (§3.5). |
| Departure / break | **No effect in v1.** Progress is monotonic within a day. Break relief is decision D9. |
| Schedule relaxation window | Progress keeps accumulating (stats is unaffected). The existing `schedule_relaxation` −1 band applies on top (§5.4). |
| Browser / worker restart | Nothing to restore. Progress is a pure function of persisted stats and settings. |

The curve keeps no persistent state of its own and needs no storage row.
Progress recomputation and goal-end cancellation are different operations:
§6.5.1 governs pending episodes when these inputs change. Recomputing progress
does not itself start a presentation or erase an actual-delivery receipt.

### 3.4 Site identity and multiple tabs

- The curve uses the key that the protection runtime already uses: the normalized
  hostname that `siteGoals` and `ProtectionRuntimeInputAssembler` resolve. It adds
  no site-identity rule. Return lock's base-domain grouping is an existing,
  separate concern.
- Every protected tab of the host gets the same quantized step. Background tabs
  are updated through the same refresh lane, so switching to one shows the
  current step without waiting for a tick.

### 3.5 Explicit non-curve states

These are declared product states, not fallbacks. Each one carries a reason code
in the envelope metadata and in the runtime snapshot, and the UI shows it.

| State | Condition | Curve-mode families behave as |
| --- | --- | --- |
| `no_budget` | No positive Site goal for the host | Fixed mode (configured strength, existing budget modifiers inactive because ratio is 0) |
| `no_basis` | Recording disabled for the domain, so the `active` basis is not admitted | Fixed mode |
| `active` | Goal > 0 and basis admitted | Curve |

A malformed goal, malformed settings or a missing stats date when recording is
admitted is not one of these states. Those fail explicitly through the existing
assembler errors. Whether curve-mode families should instead stay *inactive*
without a budget is decision D3.

## 4. Curve model

### 4.1 Persisted settings (exact shape)

New flat settings key `coolingCurve` in `settings.core` (`FLAT_KEY_TO_DOCUMENT`).
It lives in `chrome.storage.local` behind `SettingsDocumentRepository` and is
validated by `settingsStoredValueContract` through `projectCanonicalStoredSetting`.

```js
coolingCurve: {
  preset: 'gentle' | 'standard' | 'steep',
  families: {
    lens: 'curve' | 'fixed',
    veil: 'curve' | 'fixed',
    brake: 'curve' | 'fixed',
    barrier: 'curve' | 'fixed',
  },
  advanced: null | {
    startPercent: integer,   // 5..60  — budget % at which the first slot begins
    acceleration: integer,   // 50..200 — exponent × 100; 100 = linear warp
  },
}
```

Rules:

- **Exact keys.** All four family keys are required. Extra keys, other enums,
  non-integers and out-of-range values reject with
  `COOLING_CURVE_SETTING_INVALID:<field>`. Nothing is rewritten.
- **Defaults.** When the key is absent, the policy owner provides the default
  (§4.4) at the settings default boundary, the same way `ensoGate` does. A present
  but invalid value is never treated as absent.
- **`advanced`.** `null` means "use the preset". Choosing a preset writes
  `advanced: null` in the same command. The field exists from V1 so the post-launch
  advanced editor (P3) needs no public storage transition, as
  `storage-versioning-and-migration-policy.md` would otherwise require.
- **Families.** Keys are the canonical artifact family IDs. Shishi Gate and the
  periodic Barrier interaction are not curve families.
- **Retired `globalFrictionLevel` (decision D1, adopted).** The Settings Protection preset
  selector writes `coolingCurve.preset`. A single mapping in the policy owner
  (`gentle→gentle`, `standard→balanced`, `steep→strict`) derives posture for the
  remaining `LevelResolver` consumers (fixed-mode lanes, artifact triggers). The
  integer 1–5 key is removed, not aliased. Under the pre-release policy, a stored
  `globalFrictionLevel` then rejects, and the documented development-profile reset
  handles it. Add a row to the storage versioning cleanup ledger.

Write path: `useProtocolStore` typed command (`setCoolingCurvePreset`,
`setCoolingCurveFamilyMode`, `setCoolingCurveAdvanced`) →
`ProtocolSettingsCommandService` → `SettingsCommandService` →
`SettingsService.applySettingsChange` → existing propagation and protection
broadcast. No feature code writes storage directly.

### 4.1.1 Public policy editing

Settings -> Protection is the public preset and reminder-policy editor.
`SettingsProtectionSection` uses the parked typed protocol store and acknowledged
commands. Filter has no duplicate preset editor; Tools owns family modes and
enabled-effect strengths. Sites owns time goals and their recorded facts.

Reminder activation is stored once in `nudgeConfig.goalEnds: { site, global }`.
The two booleans default OFF only when configuration is absent. A present config
with the old `enabled` field or invalid/missing `goalEnds` rejects untouched;
the explicit development-profile reset is required. Runtime assembly derives
aggregate activation, never another stored master. Named `setGoalEndEnabled`
updates one scope against the latest settings under the existing serialized
mutation, preserving the sibling and internal presage/episode parameters.

Only enabled scopes participate in selection, combined delivery and periodic
priority. Episode signatures bind their covered preferences, so unrelated scope
edits retain valid work. Presets cannot enable disabled goals or suppress enabled
goals; global/family pause remains explicit. The existing approved installation
journey enables only Global through the same typed contract. Tools Furin shows
the scoped policy, prerequisites and temporary pause with a link to Settings.
Safety, deduplication, priority and cancellation are fixed guarantees explained
in the UI; P2 Horizon/Furin routing remains future scope.

### 4.2 Code-owned preset catalog (not persisted)

Implemented owners:

| Concern | Canonical path |
| --- | --- |
| Persisted shape, defaults, preset IDs, posture mapping | `src/domains/settings/config/coolingCurvePolicy.js` (sibling of `ensoIntervalPolicy.js`) |
| Preset parameters and slot table | `src/domains/protection/catalog/coolingCurvePresets.js` (sibling of `postureProfiles.js`) |
| Pure resolver: `(budgetProgress, coolingCurve, family binding) → per-feature curve intents` | `src/domains/protection/runtime/coolingCurveResolver.js` |

```js
COOLING_CURVE_PRESETS = {
  gentle:   { startPercent: 35, acceleration: 140 },
  standard: { startPercent: 22, acceleration: 100 },
  steep:    { startPercent: 12, acceleration: 75 },
};

// Slot windows in warped space w ∈ [0, 1]. Values derived from the landing:
// standard (start 22, accel 100) uses the landing's nominal 22/42/58/76 windows.
COOLING_CURVE_SLOTS = {
  tint:   { onset: 0,     full: 0.231 },  // landing 22 → 40
  signal: { onset: 0.256, full: 0.436 },  // landing 42 → 56
  blur:   { onset: 0.462, full: 0.641 },  // landing 58 → 72
  pace:   { onset: 0.462, full: 0.641 },  // shares the blur slot; not on the landing
  text:   { onset: 0.692, full: 0.846 },  // landing 76 → 88
};
COOLING_CURVE_FINAL_APPROACH = { onset: 0.923 };  // nominal landing 94% window; see quantization in 4.3
COOLING_CURVE_STEPS = 16;
```

Child → slot binding uses the canonical family/child binding
(`canonicalArtifactRuntimeBinding.js`). An unbound child of a curve family fails
the guard; it never defaults to a slot.

| Family | Child (by canonical binding) | Slot | Intensity form |
| --- | --- | --- | --- |
| Lens | saturation child → colorSaturation; brightness, contrast | `tint` | strength scale |
| Lens | grayscale child → saturation | `text` | strength scale; explicit ON only |
| Lens | blur | `blur` | strength scale |
| Veil | socialMetrics, timeSignals | `signal` | binary onset |
| Veil | shortformBlock | — excluded | structural block; follows family ON/OFF only |
| Brake | clickPause, scrollFriction, inputVisualBrake, skipFriction | `pace` | binary onset |
| Barrier | textRhythm | `text` | band (relaxed → normal → reinforced) |
| Barrier | intentThreshold, detourSpreadGuard, tabManagement | — excluded | decision/structural; not graded |

Slots are fixed, not compacted (decision D5). If a user turns on only blur, nothing
changes before its nominal 58% window under the standard preset. Disabled stages
are skipped in the user-facing explanation; their absence does not move other
stages earlier.

The preset numbers are product starting points, mirroring the landing. They are
not validated efficacy thresholds (same disclaimer as the Barrier consumption intervals).

### 4.3 Curve law

```text
p      = budgetProgress                      (≥ 0)
s, a   = advanced ?? preset   → s = startPercent/100, a = acceleration/100
w_raw  = clamp((p − s) / (1 − s), 0, 1) ^ a
step   = floor(w_raw × 16)                   (0..16, integer)  ← the only quantity sent
w      = step / 16
ended  = p ≥ 1

per child c in slot k:
  r_c  = smoothstep(k.onset, k.full, w)       (0..1)
  isActive_c = userActive_c && r_c > 0
  scale form:   strength_c = round(userStrength_c × r_c)        (integer 0..100)
  binary form:  ON once r_c > 0
  band form:    r_c < 0.5 → relaxed, else normal
  final approach: w ≥ 0.923 (or ended) → graded Lens/text children get +1 band
                  (reinforced, 1.35 Lens scale); binary children remain ON
```

- The curve reaches the user's configured strength at each slot's `full`. It then
  reaches the existing reinforced band near the target, and plateaus at 100% and
  beyond. The "hard to use near the target" state is the vocabulary that already
  exists (reinforced band). There is no hidden extra strength band, which the
  Sites map forbids for global-cap reinforcement.
- Monotonic in `p` for fixed settings. At most 17 step values per unchanged
  settings/activity-day; settings edits, navigation and lifecycle dispatches are
  separate from step-crossing traffic.
- User OFF stays OFF. The curve never activates a child the user turned off. That
  is the existing envelope invariant.

P1-C adopts the 16-step floor quantization (D8): under standard, the first
positive tint step is at 26.875% and final approach starts at 95.125%, before
the tracking beat. Nominal landing windows are reference points, not exact
production onsets. Near-integer floating arithmetic is canonicalized only within
round-off precision; no pre-attainment ratio can produce the ended step. The
landing's nominal 94% phase is not a goal-end trigger: attainment remains 100%.

The independently configured Lens grayscale uses the late `text` slot, rather
than the early media `tint` slot. Under standard, its first positive step is 12
(80.5% budget progress), full configured strength is reached at step 14 (90.25%),
and reinforced final approach starts at step 15 (95.125%). These are theoretical
quantized boundaries before the existing tracking refresh. Lens `fixed` uses
an enabled grayscale's configured strength immediately. Grayscale OFF remains
OFF even at attainment; media desaturation never enables the page-wide filter.

### 4.4 Default

```js
{ preset: 'standard',
  families: { lens: 'curve', veil: 'curve', brake: 'fixed', barrier: 'curve' },
  advanced: null }
```

Brake defaults to `fixed` because pace friction is binary and not part of the
landing story (decision D4).

## 5. Runtime flow

### 5.1 Ownership

| Concern | Owner | Notes |
| --- | --- | --- |
| Time accounting | Existing stats/tracking (`TabTimeTracker`, stats activity-day facts) | Unchanged. No new listener, heartbeat or timer. |
| Budget ratio | `BudgetSnapshotReader` | Unchanged single owner. |
| Curve evaluation | `coolingCurveResolver` (pure), called during `TrackingProtectionService` evaluation | One call per evaluation. Returns modifier intents plus `{ state, step, ended }` metadata. |
| Modifier emission | `EnvelopeAdapter.mergePlanFiltersWithBase` | For curve-mode children: emit curve modifiers and **do not** emit `policy_strengthening` or site `target_overrun` (the curve replaces both). Fixed-mode children keep today's behavior exactly. |
| Step-crossing push | `CoolingCurveStepRefreshCoordinator.checkCoolingCurveSteps(now)` from existing `trackingTickRunner.runAdmittedTick`, after `checkGlobalCapStatus` | Reads canonical activity-day facts once per actual protected host. A worker-local `lastStepByHost` commits only after all same-host tab refreshes and managed registrations succeed. Gate-held projected pages are excluded; no new timer or durable state. |
| Dispatch | `ProtectionDispatchSerialQueue` / `ProtectionDispatchStateLedger` | Payload-signature dedupe drops unchanged envelopes. |
| Content application | `ProtectionFrictionModifierRuntime` → `ProtectionStateApplier` → effect managers | Applies modifiers. Never reads time or computes progress. |
| Prepaint | `bootstrapEarlyRuntime` and the managed prepaint registration owner | Resolve the same modifiers without multiplying scale twice; effective integer strengths use existing quantized assets. At most 17 distinct curve steps per unchanged host/day; settings/lifecycle and bounded existing-cache TTL renewals are separate work, coalesced by the same registration tail. |

### 5.2 Modifier vocabulary changes

```js
FRICTION_MODIFIER_SOURCES.COOLING_CURVE = 'cooling_curve';
FRICTION_MODIFIER_PRIORITIES.COOLING_CURVE = 250;       // between policy (220) and schedule (300)
FRICTION_MODIFIER_OPERATIONS.SCALE_STRENGTH = 'scale_strength';

// intents emitted per curve-mode child, scope { kind: 'domain', hostname }
{ operation: 'suspend' }                                   // r_c = 0 (before onset)
{ operation: 'scale_strength', strengthPermille: 0..1000 } // scale form, quantized from w
{ operation: 'adjust_intensity', delta: +1 }               // final approach / ended
```

`strengthPermille` is computed from the quantized `w`, so the payload changes only
on a step change. `scale_strength` applies only to Lens scale-form children.
Other targets reject with `FRICTION_MODIFIER_OPERATION_TARGET_INVALID`.
Compiled Lens entries retain configured `strength` and exact
`frictionModifierScale: { strengthPermille, priority }` provenance. The sanctioned
visual-profile bridge scales once before band materialization. Background,
content re-resolution and prepaint therefore produce the same integer strength;
this is compiled runtime metadata, never another stored user setting.
Binary Veil/Brake children have onset only, without an unsupported strength band.

### 5.3 Messages

- A content document receives one `PROTECTION_UPDATE` per step change (≤ 17 per
  site-day, plus `ended`), plus the existing settings, navigation and focus
  dispatches.
- No per-frame or per-second messaging. Latency from crossing a step to its effect
  is at most one tick beat plus dispatch.
- The existing bootstrap TTL still applies. An unchanged-step cache nearing
  expiry is refreshed by the same minute ingress and existing registration tail,
  without sending a content update. Expired/missing caches keep the documented
  explicit prepaint miss behavior; no stale policy or new timer is substituted.
- Visual managers may animate between consecutive stage values with a short CSS
  transition (presentation only, `prefers-reduced-motion` honored). They never
  derive intermediate progress.

### 5.4 Composition with existing modifiers

Applied by the existing resolver ordering:

| Combination | Result |
| --- | --- |
| Curve + `schedule_relaxation` (−1) | Dominant-delta rule as today. Relaxation can cancel the final-approach +1. Pre-onset suspend stays. |
| Curve + fullscreen visual suspension | Configured fullscreen relief wins for curve children, including Site 100%. Removing the Site overrun modifier also removes its fullscreen-relief block for those children; final-approach is never an attainment marker. Fixed children retain their existing Site overrun block, and Global overrun retains its independent block. |
| Site Furin Continue | Keeps the curve at plateau. Do not activate the dormant `furin_stay_suspension` vocabulary as an implicit filter pause. Explicit user pause remains separate. |
| Curve + `global_target_overrun` (global daily goal, +1) | Kept. A different budget. Still at most +1 band. |
| Existing Global outcome (`max_filter` / 15-minute `release`) | Existing outcome policy remains a separate, explicitly reported override of curve application. It does not reset site usage or mark a site-goal end delivered. Implementation must verify envelope/prepaint parity for both outcome states. |
| Curve + `policy_strengthening` / site `target_overrun` | Not emitted for curve-mode children. The curve is the only budget-to-intensity law for them. |
| Fixed-mode child | Unchanged from today. |

`LevelResolver`, lanes and `BUDGET_NEAR_EXHAUSTED` / `BUDGET_EXCEEDED` direct
triggers stay in place for artifact plan triggers and fixed-mode children. Their
posture comes from the preset mapping (D1).

### 5.5 Runtime snapshot

The snapshot exposes `runtime.coolingCurve: { state: 'active'|'no_budget'|'no_basis', step, ended, preset }`.
The dashboard Filter status sidebar (`useFilterRuntimeModel`), Sites and popup
read it through the existing protection runtime snapshot bridge. They never
recompute it.
`no_budget` and `no_basis` apply the existing fixed-family policy, including its
independent policy modifiers; they emit no curve modifier. Fixed means the
existing configured-strength system, not a new lock against every policy band
adjustment. The visible reason explains why budget-driven ramping is absent.
The strict content snapshot/patch envelope is V2. V1 live messages reject;
there is no compatibility decoder. Profile reset/generation and existing
rebootstrap ownership handle derived prepaint rebuilds. Raw curve progress never
crosses this new field; Global release/max-filter retain real curve metadata and
their separate application override.

Goal-end state has a separate P1-B `runtime.goalEndSummary` projection through that
same bridge: Site/Global attainment, delivery status, waiting reason and actual
final renderer. The strict V1 host/day DTO contains separate Site/Global scopes,
each with `attained`, `delivery`, `reason`, `phase`, `runId` and `renderer`.
Its facts come from fresh budget inputs, exact session binding and the typed daily
writer (§6.7), not from UI calculations. Do not put delivery into the curve's
`ended` boolean: goals/Furin also work with fixed curve families, and an attained
goal may still be waiting for safe delivery.

## 6. Goal ends, shared Horizon and periodic Barrier reflection

### 6.1 Separate purposes, one boundary infrastructure

Horizon is a readable boundary in a consumption flow. Periodic Barrier reflection is one
optional use of that boundary, not the boundary's activation owner. A site goal
and a Global goal are different attainment facts; neither makes the Enso cadence
receipt eligible. Use explicit purposes in background admission and the content
episode: `periodic_reflection`, `site_goal`, `global_goal`.

| Purpose | Eligibility owner | Final presentation | Meaning |
| --- | --- | --- | --- |
| Periodic Barrier reflection | Existing independent Off / 8 / 12 / 20-minute operational cadence | Horizon with one light continuation/finish choice on supported feeds; existing classified-action coverage elsewhere | One breath of use; not today's goal reached |
| Site goal, P1 | Existing Site goal attainment and goal-end enable preference | Site Furin; on a supported feed, Horizon must precede it | This site's daily goal reached |
| Site goal, P2 | Same Site attainment and enable preference | Either declarative Budget Horizon, or Site Furin with its required feed prelude | One site-goal end, not two successive announcements |
| Global goal | Existing Global daily attainment and Global Furin enable preference | Global Furin; on a supported feed, Horizon must precede it | The overall daily goal reached |

Turning periodic Barrier reflection OFF removes only periodic demand. Furin ON still supplies
feed observation, topology qualification and endpoint demand. Pausing Barrier or
choosing fixed curve families does not disable a Furin-owned prelude; it also
does not enable periodic Barrier reflection or any disabled Barrier child. P2 retains one
site-goal end preference rather than adding separate Horizon and Furin switches.
Its public label must explain the capability-selected presentation.

Share `FeedTerminusController`, `FeedEndpointLease`, topology safety and exact
cleanup. P1-A extracts their episode lifecycle from the cadence-specific
`EnsoRuntimeEpisodeManager` into a named shared `FeedBoundaryEpisodeCoordinator`
under `src/domains/nudge/feed-flow/`; the Enso producer remains cadence-specific.
There is one actuator and one admitted owner per episode, with explicit purpose,
phase and renderer. The shared boundary is not a second Enso timer or a parallel
Furin presentation lane.

### 6.2 Required Horizon before Furin (P1 dependency)

The product invariant is to finish the current content before asking for a
decision. For **both Site and Global Furin on a qualified feed**:

```text
goal eligible -> fresh safe feed boundary -> one episode/lease
  -> Horizon attached beyond the current item -> actual Horizon encounter
  -> arriving input finishes -> fresh deliberate forward action
  -> Furin starts inside the same episode -> choice/exit -> cleanup/end
```

- Attachment alone is not encounter. Furin cannot start on a goal timer, endpoint
  attachment, arriving momentum, a render callback or elapsed stillness.
- The fresh continuation action opens Furin directly. Do not insert the periodic
  Barrier reflection question or Gesture Gate before Furin. Horizon and Furin are two phases
  of one budget episode, not two questions with a recovery gap between them.
- Encounter and fresh continuation are necessary, not sufficient: the current
  surface must still satisfy its content-boundary evidence (§6.2.1), and the
  background must still authorize the goal (§6.5.1).
- Users may finish reading, remain at the boundary, or move backward. No timeout
  turns that pause into forced Furin. Hidden/navigation/disable invalidation uses
  the exact existing cleanup and lifetime rules.
- This prerequisite applies when only Furin is enabled. It is required in P1;
  only the Horizon-only site-goal renderer waits until P2.

Non-feed pages use a declared action/media boundary mode through the existing
Furin entry owner (`nudgeEntrySeamGate.js`), preserving the current item before
presentation. Mere idle, cap expiry or timer expiry is not proof of an item end.
That mode needs explicit boundary evidence and verification in P1. An unqualified
or temporarily unsafe **feed** does not silently become this non-feed mode: keep
`waiting_for_safe_boundary`/unsupported diagnostics, plateau and read-only status,
and await a fresh proven boundary. No guessed endpoint or timer-only overlay is
allowed to hide limited site support. Goal attainment is not a guarantee of timely
ritual delivery on every page.

#### 6.2.1 Screen capability and safe-boundary evidence (P1-A)

This is a proposed admission matrix, not a list of certified sites. A surface
profile must declare the mode and prove it through the existing targeting,
topology and action/media owners. Feed structure proves placement safety; it
does not by itself prove that a simultaneous primary video has ended. No generic
text heuristic, DOM supply increase, idle duration or time cap supplies that proof.
For mixed screens, primary-media protection takes precedence over a generic feed
match: satisfying feed geometry alone never bypasses the primary-content row.

| Current screen | Required evidence and allowed flow | Insufficient evidence / required inhibition |
| --- | --- | --- |
| Continuous feed | Confirmed forward displacement plus qualified current item/complete row, same scroller and live safe endpoint geometry. Place Horizon beyond the current item; encounter plus a new forward action may continue to Furin after current-context revalidation. | Wheel intent alone, offscreen item supply, layout movement, reverse/revisit, arriving momentum, typing or selection do not authorize final presentation. |
| Paged/short-form feed | Declared paged/snap adapter confirms an actual item transition and supported endpoint topology; preserve the current visible item. Only a later fresh forward action after Horizon encounter may continue. | A wheel burst, held key, unconfirmed snap, autoplay transition or programmatic scroll cannot manufacture the boundary/action. Unknown topology waits. |
| Primary video with comments or another adjacent feed | Bind evidence to the current primary media/content identity. A Furin handoff requires its verified natural end with no active successor, or the user's classified selection of different primary content. A supported feed still requires Horizon first. Recheck the primary media at the handoff. | Comment scrolling/endpoint encounter does not end the primary video. Pause, seek, volume, captions, fullscreen controls, another media element's `ended`, and automatic next-video start are not permission to interrupt. |
| Long article/document | No feed endpoint inside the document. A declared next-article/new-content action may admit non-feed Furin through an exact prepared permit; an explicitly supported semantic document-end adapter would need separate evidence and verification. | Bottom-of-page, reading time, inferred reading completion, idle and arbitrary links do not prove completion. Preserve selection, editing and current-content controls. |
| Non-feed content selection/list | Existing action classifier confirms the actual target is owner-declared `new_content`/continuation, with a fresh prepared permit consumed synchronously on that action in the same document. | Generic buttons, Enter/PageDown, like/expand, utilities, escape/navigation controls or a surrounding card are not sufficient. Without a prepared permit the native action proceeds; no late replay or overlay on the destination. |
| Standalone media screen | Planned Furin-only media-end mode: exact current media identity has genuinely ended, is still ended, and no successor/autoplay is consuming new content at final authorization. Explicit new-content selection may instead use the action mode. | Generic document `pause`/`ended`, loop/seek end, hidden media, a stale end event or active successor do not qualify. Ordinary play/pause/seek remains native. |
| Unknown, mixed without primary-context proof, or temporarily unsafe screen | No blocking presentation. Expose the waiting/unsupported reason; keep current goal state and applicable curve, then re-evaluate only on a fresh proven opportunity. | Never reinterpret an unknown feed as non-feed or replace failed qualification with an arbitrary click, guessed endpoint or timer overlay. |

The Furin entry owner keeps the complete canonical media inventory. A dormant
YouTube Watch player left in the DOM on a declared Shorts route is not a second
primary consumption context only when its Watch container is explicitly hidden
and has computed `display: none`,
the video has no current/attribute/object/child-source identity, is paused with
`HAVE_NOTHING` and `NETWORK_EMPTY`, and has no rendered box. This narrow
classification belongs to `furinEntryBoundary.js` and is rechecked at handoff;
it does not certify that any primary media has ended. Watch routes themselves
remain unsupported. A loaded, playing, rendered or ambiguously owned external
video still blocks entry. Audio and iframe inventory retains its existing
containment requirement; hidden geometry alone is never an exclusion.

On the declared YouTube Shorts surface, `furinEntryBoundary.js` also owns two
explicit auxiliary-frame roles. Both require a connected direct child of the
current document's body, no `srcdoc`, no `allow`/fullscreen grant, computed
`display: none` and no rendered box. No observer entries are removed.

- **Passive Google sign-in helper:** exact HTTPS
  `accounts.google.com/ServiceLogin`, unique `service=youtube`/`passive=true`/`continue`, no
  `redirect_uri` or sandbox, and an absolute credential-free `continue` destination at
  `https://www.youtube.com/signin`. This is a narrowly declared platform
  authentication role, not proof that an opaque child document contains no media.
  The endpoint is Google's [account sign-in entry](https://accounts.google.com/ServiceLogin).
  Other Google hosts/paths, arbitrary continuations and player feature grants
  remain unsupported.
- **Inert blank sandbox:** explicit `about:blank`, sandbox tokens exactly
  `allow-same-origin` (no script capability), and an accessible, complete
  `about:blank` document containing only empty `html`/`head`/`body` structure,
  with no author shadow root through canonical `open_and_closed` access. An opaque,
  scriptable, populated, navigated or `srcdoc` blank frame does not qualify.

The entry owner rechecks these roles at handoff. Source, permission, document,
rendering or role changes return the existing unsupported/waiting diagnostic;
they never substitute an arbitrary boundary or a timer. The passive-auth role
must be removed or revalidated if that platform endpoint ceases to serve the
declared authentication purpose. Unknown iframe and external audio protection
remain unchanged; native QA records the exact qualifying facts and refusals.

The media-end row is a proposed Furin entry mode, not a new periodic Barrier reflection source.
Periodic non-feed Barrier retains its classified-action contract; media end, focus
or visibility alone does not create a periodic opportunity. Preparation cannot
freeze an action/media proof across navigation, primary-content change or autoplay.
Use the existing candidate freshness and exact document/input ownership rather
than a new timeout that forces display.

Before P1-A, the receiver already rejected idle/cap commits, but the seam still
accepted broad interactive clicks/keys and generic pause/ended events. P1-A
narrows entry to qualified feed prelude or classified prepared non-feed action;
it does not claim semantic media-end support for the whole matrix.
`FeedActuationSafetyJudge`, feed advance/terminus owners, `ClickBoundaryClassifier`
and the existing media identity/broker owners retain their factual authority.
The shared boundary coordinator owns placement, entry phases and cleanup only;
it does not calculate budgets, rank goals or write daily delivery records.

P1 includes a read-only waiting/unsupported status through `goalEndSummary` in
the existing Filter runtime status surface, for example goal reached but waiting
for a safe content boundary, or feed endpoint not supported here. Separate
`waiting_for_safe_boundary`, `surface_unsupported` and actual policy/transport
errors. Do not show a countdown promising an inevitable ritual. Full Sites/popup
progress remains P2; a silent indefinite wait is not the P1 user experience.

### 6.3 P1 and P2 site-goal presentation

**P1:** At `ended`, the site curve remains at final approach. Keep the existing
Site Furin ritual and its actual-display daily cap, with the required feed prelude
from §6.2. Continue leaves the curve at plateau; it does not reset the goal or
silently suspend the filters. Explicit pauses and existing Global outcome
overrides are shown separately (§5.4).

**P2:** Select the final renderer before reservation from declared current
surface capability and the enabled goal-end policy:

| Declared capability | Site-goal renderer | Flow |
| --- | --- | --- |
| Qualified feed supports declarative goal endpoint | `budget_horizon` | Horizon states that today's site goal is reached; no required choice or Gesture Gate; passing it continues at plateau |
| Declared non-feed action/media boundary | `site_furin` | Safe entry boundary -> Site Furin |
| Global/combined goal takes priority on a qualified feed | `global_furin` | Required Horizon prelude -> fresh continuation -> Global Furin; explicitly convey any covered Site goal |
| Unknown/unsafe feed boundary | No admitted final renderer yet | Explicit waiting/unsupported state; no abrupt Furin substitution |

In the normal qualified-feed P2 route, Budget Horizon is the site's goal-end
presentation **instead of** Site Furin. Do not play Furin and later attach a
separate Budget Horizon for the same goal. A selected route remains fixed for
its lease; a failed mount is an explicit failure, not permission to switch
renderers within that episode. Goal-end eligibility is not derived from a prior
Site Furin display receipt.

The Horizon-only goal end is declarative, in the boundary category described in
`AGENTS.md`; it is not a hard stop. Finality refers to the user's daily goal,
while the site remains usable. Periodic Horizon uses lighter intermediate copy
and must not claim that today's goal ended.

### 6.4 Periodic Barrier reflection is a separate, lighter choice

The existing independent Off / 8 / 12 / 20-minute control remains in Barrier.
Curve preset selection, enabling Furin and Furin's boundary demand do not change
that choice. Its current default is not changed implicitly by this proposal.
The periodic check may appear before a site goal when separately enabled; the UI explains it
as intermediate reflection, not a shortened daily allowance.

The proposed interaction budget is one compact finish/continue choice, accessible
with keyboard and reduced motion. Prefer the simple choice; a bounded gesture is
an alternative to that choice, never an additional gate or mini-game. It must
require less ceremony and interaction than Site Furin and must not become a more
demanding obstacle. Exact gesture travel/time and the comparison with brief
Furin remain a focused design decision in D6; do not copy today's full Gesture
Gate unchanged as a settled solution. Fresh-action and arrival-momentum guards
remain mandatory whichever presentation is chosen.

### 6.5 Priority, overlap and cadence

When no episode already owns/reserves the surface, first apply enable policy,
actual attainment and daily delivery caps, then choose among unserved eligible
candidates: **Global goal -> Site goal -> periodic Barrier reflection**.
Mandatory isolation/return-lock policy still outranks ordinary work. This
candidate policy belongs in the background admission/dispatch owners, not in
content ranking or a new deferred queue.

- If Site and Global are both actually reached and still unserved at the selected boundary, one
  Global Furin episode may explicitly communicate both reasons for the current
  host. It gets one Horizon prelude and records only the goals actually conveyed.
  Being near Global is insufficient: P1-B removes `near_global_combined`
  early substitution and rejects the retired trigger at its input boundary.
- An attached or displayed ordinary episode keeps its exact owner. A later goal
  does not steal an Enso lease, mutate its purpose, or place a second endpoint.
  Update goal state immediately, then re-evaluate unserved goals after exact
  cleanup and the existing recovery, on a fresh safe opportunity. A goal attained
  during an already displayed periodic episode is not deemed delivered by it.
- No queue of missed periodic checks, no countdown to an automatic replay, and
  no question added after another question just because time was due. Unshown
  cancellation/failure does not consume goal delivery or cadence.
- Keep the existing 45-second recovery after the **whole** actually presented
  episode ends. Do not apply recovery between a Furin prelude and its Furin.

The proposed cadence accounting is purpose-specific, committed once by
`InterventionAdmissionService`: a periodic reflection ends -> reset; an actual
Site/Global Furin ends -> reset; a P2 Budget Horizon-only goal end is actually
encountered and ends -> reset as explicit goal-boundary credit (not a claim of
reflection or cognitive recovery). Attachment and a Furin prelude without actual
Furin do not earn that credit. Only actually presented ownership pauses cadence
accrual. No credit changes site/global usage or the site's plateau.

| Example (fresh cadence, no other intervention) | Result |
| --- | --- |
| Site 10 min, Barrier interval 12 min | Site end first; required feed prelude if supported; Furin end restarts the periodic interval, so there is no inherited check at minute 12 |
| Site 30 min, Barrier interval 12 min | Intermediate checks may occur first; neither resets site usage; site end is separate and delivered once |
| Site and periodic check become eligible together | Site-goal episode first; no following catch-up check |
| Global and Site both reached at one boundary | One explicit combined Global episode for that host, not two Furin games |
| Global shown, another host later reaches its own goal | That host still receives its own unserved site-goal end, subject to safe boundary and daily cap |
| Goal reached while a periodic endpoint owns the feed | Curve plateaus now; existing endpoint finishes; goal delivery remains unserved until a later admitted boundary |

#### 6.5.1 Revalidation and cancellation of a goal episode (P1-B)

Bind each goal episode to exact tab/document/profile generation, normalized
host, activity-day and reset-hour basis, purpose, the goal values and covered
scopes that justified it, relevant semantic policy signature, and lease/phase identity.
The background owns current attainment, recording admission, enable/protection
policy and daily cap; content supplies current screen/boundary facts and checks
its local generation. Content never recalculates a usage/goal ratio.

Revalidate on relevant settings/recording/activity-day ingress and before each
privileged transition: candidate selection/reservation, endpoint attachment,
actual Horizon encounter, and final Furin start or P2 goal-Horizon delivery.
An old attached endpoint is not a permanent authorization to start Furin.
Worker recovery probes the exact document and current policy before continuing
any restored episode; unavailable policy or failed cleanup preserves ownership
and reports an error rather than assuming permission or successful release.

| Change or revalidation result | Unserved candidate / attached or encountered prelude before final delivery | Already acknowledged final delivery |
| --- | --- | --- |
| Site/Global goal increased | Cancel the affected old binding and clean its exact endpoint. If current usage is below the new goal, eligibility is gone; if it still meets the new goal, only a new selection/permit at a fresh boundary may deliver it. | Preserve the actual original receipt and consumed host/day or Global/day cap; the edit does not rearm delivery. |
| Goal decreased | Recompute current eligibility; invalidate any old affected binding. Settings broadcast cannot present or replay an input. A newly reached unserved goal waits for a fresh safe boundary. | Preserve the cap even if the goal is changed again. |
| Goal removed; relevant recording basis revoked; goal-end disabled; protection/permission revoked | Cancel only purposes/scopes that now lack authority. Site recording OFF gives `no_basis`; Site goal removal gives `no_budget`. Independently valid Global or periodic producers are evaluated from their own basis, not switched off by association. | Retain actual exposure/delivery history. End any now-disallowed live surface through exact cleanup; do not invent a choice or undo delivery. |
| Natural activity-day rollover | Cancel prior-day pending bindings and fence their callbacks. Re-evaluate the new day's canonical facts only on a fresh opportunity. | Original receipts stay attributed to their original day; the next day's normal cap starts through its owner, never a late callback. |
| Reset-hour edit, even if the date label stays the same | Invalidate the old day-basis binding; read the recomputed canonical stats/day facts before new admission. Do not substitute old facts or zero usage when the new basis is unavailable. | Do not clear, retag or rearm an already receipted day. A regressed day cannot overwrite a newer durable receipt; expose the existing stale-day/basis error until the canonical day is admitted. |
| Theme, language, curve preset or other unrelated revision only | Revalidate relevant predicates, but keep a still-valid goal binding. A global settings revision difference alone is not a cancellation reason; display copy may update without changing purpose or covered scopes. | Never reopen delivery. |
| One cause of an unserved combined Site/Global episode changes | Cancel the whole old composite binding, clean it, then select currently eligible unserved causes anew. Do not silently drop/add a cause, change the renderer or rewrite coverage on a live lease. | Keep exactly the scopes actually conveyed at the authorized final display; future goals remain separate. |
| Exact document/primary content, topology or source-action proof becomes invalid | Existing lifetime owners cancel/revoke the affected episode and prove cleanup. A replacement document or action cannot consume the old permission. | Retain real display receipts; record the actual exit/cleanup reason without a synthetic continue/leave ACK. |

For a relevant edit, invalidating the old binding is separate from deciding that
the new goal is still eligible. Re-admission never reuses the old scroll/click,
endpoint reservation or input replay. Removing and re-adding a goal on the same
receipted host/day does not create another final-delivery opportunity.

Cancellation targets the exact episode, lease and content generation and fences
late async grants, imports, callbacks and final-display acknowledgements. It
does not steal an unrelated ordinary owner (§6.5): changed authority is a distinct
reason to end the affected episode. Release is committed only after exact cleanup
proof. If its prelude was actually encountered, preserve that exposure and normal
whole-episode recovery, but do not mark Furin/final goal delivery or award Furin
cadence credit. An unshown cancellation consumes neither delivery nor recovery.

Once final display was validly authorized and actually acknowledged, a later
edit cannot erase that fact. It may require ending the live surface with its
real termination reason. Keep presentation authorization, receipt and cancellation
bound to their source revision/day; reject stale final transitions rather than
painting a newly ineligible goal. DOM paint, settings commit and storage are not
one atomic transaction: report ambiguous late exposure/ACK races explicitly,
without manufacturing current-day delivery or releasing an unproved owner.

#### 6.5.2 Close-goal and cancellation validation scenarios

These are planned verification cases, not new cooldown/coalescing policy or
claims of completed QA. Synthetic goal facts must be labeled as synthetic.
Measure times from the acknowledged end of a whole episode; recovery uses wall
time while goal/cadence accounting retains its own existing time basis.

| Scenario | Durable expected behavior | Experience question / evidence |
| --- | --- | --- |
| Site Furin ends; Global first becomes attained 60 seconds later | No early Global coverage at the Site display. After recovery and a new safe boundary, one independent Global episode may occur. | Record interval, preserved current item, displayed reasons and number/weight of interactions; is the second ending understandable or repetitive? |
| Global first becomes attained 15 seconds after Site end | Show attained/waiting state, not a new ritual during the 45-second recovery. Recovery expiry alone does not replay or start it; require a fresh valid opportunity. | Check that no countdown or automatic burst promises/produces a second interruption. |
| Global ends; a different host reaches its Site goal 60 seconds later | Later Site end remains eligible: brief Furin in P1 or qualified-feed goal Horizon in P2. No blanket Global absorption. | Does the local reason remain clear without repeating the full Global ceremony? |
| Global becomes attained while a Site Horizon is attached or its prelude is encountered | Do not steal or relabel the valid Site owner. Finish/cancel it through its own lifecycle, then re-evaluate Global after cleanup/recovery at a fresh boundary. | Record waiting duration, goal state visibility and absence of two endpoints or an abrupt replacement. |
| Both scopes are actually attained and unserved at one new boundary | One Global episode explicitly conveys only the current host's reached Site goal; atomic Global and site-end delivery evidence, no fake Site Furin display. | One prelude/decision, two accurate reasons, no later duplicate for the covered host. |
| Site is attained but Global still has one minute remaining | Site-only delivery; `near_global_combined` must not report or consume Global. Later actual Global is independent. | This near-but-not-overlapping case is specifically reviewed for interaction density without pretending the future goal was reached. |
| Goal increase/removal or recording OFF before encounter, after prelude encounter but before Furin, and just after final display | First two positions cancel the affected unserved binding; last position preserves actual delivery and closes any disallowed live surface. No stale start, fabricated ACK or cadence credit for prelude alone. | Correlate policy revision, phase, exact cancellation, cleanup proof and durable receipts. |
| A combined cause changes; another tab or worker resumes; activity-day/reset-hour changes before a delayed final callback | Old binding cannot migrate scopes/document/day or consume the new day's cap. Fresh evaluation may select still-valid unserved work only after exact cleanup. | Verify same-host multi-tab dedupe, restart probes and explicit stale/unavailable states. |
| Periodic Barrier reflection is due next to one or both goals | New selection honors eligible goal priority; an already owned periodic episode is preserved. Completed goal experience earns only its specified single cadence credit; no catch-up periodic question. | Compare intermediate and final presentation weight and confirm their meanings are distinguishable. |

Use deterministic owner/receipt tests for machine invariants and the declared
intervention lifecycle/collision QA entrypoints for real rendering/cleanup and
human interaction review. Capture decisive phase/identity/receipt evidence;
fixtures do not certify natural elapsed consumption or site support. Experience
review has no invented pass threshold for how many seconds feel acceptable.
If adjacent genuine goals are too burdensome, record a separate density-policy
decision with owner and evidence; do not add a new timer, suppress future Site
ends, or count a not-yet-reached Global goal as delivered in this implementation.

### 6.6 Global does not cover future Site ends (implemented P1-B policy)

P1-B replaces the former whole-day Global-to-Site suppression with scoped coverage.
Global is still one actual full presentation per activity-day. Site-goal delivery
remains once per host per activity-day even after Global has been seen. To limit
ceremony, later Site Furin uses `brief` after an actual Global presentation; do
not invent a Site full receipt to select that form. P2's Horizon-only site end
also remains eligible after Global.

Only an actually displayed combined Global episode may cover the current host's
already-attained, unserved Site goal, and its copy must explicitly communicate it.
It does not cover other hosts or goals attained later. Global showing alone
cannot mark them shown, selected, or completed. The owning
[Active daily policy](furin-daily-delivery-policy.md) records this implemented
replacement of the former intentional whole-day suppression.
An already delivered Global goal is no longer a candidate even while its usage
remains over the goal; it cannot absorb a later Site end merely by winning the
scope priority again.

### 6.7 Facts, lifecycle, display and delivery records

Keep these distinct in the background snapshot and diagnostics:

| Layer | Owner/evidence | What it does not prove |
| --- | --- | --- |
| Goal attained | Existing budget inputs; normalized host/activity-day, scope and settings revision | Nothing has necessarily rendered |
| Candidate/reserved/endpoint attached | Exact admission lease, purpose, renderer and document; session checkpoint | Attachment is not actual encounter or final delivery |
| Actual boundary/Furin exposure | Separate acknowledged Horizon encounter and actual Furin start, with phase and exact episode/run/document | A prelude encounter does not prove Furin shown or user choice |
| Site-goal delivery | Durable acknowledged final renderer: `budget_horizon`, `site_furin`, or `combined_global_furin` for the exact host/day | Delivery is not a continue/leave ACK and is not a display of another renderer |

Use the existing typed `FurinDailyReceiptRepository`/store and `furinDailyPolicy`
writer as the single daily delivery owner. P1-B extends its exact schema with
site-goal delivery records ready for the P2 renderer. Do not add an independent
Horizon daily log or use UI caches as authority. V2 `siteEnds[host]` is exactly
`{ runId, presentedAt, renderer, scopes }`. Existing `sites[host]`, `fullSite` and `global` continue
to mean actual Furin evidence. One serialized commit records an actual Site
Furin and its site end, or an actual combined Global and its explicitly covered
site end; it never fabricates a Site Furin display for a Horizon/Global renderer.

For P1's Furin route, the final-delivery point is actual Furin start, not its
prelude. For P2's Horizon-only route it is actual goal-Horizon encounter. Failed
mount, a blocked candidate or an attached-but-unseen boundary consumes neither
cap. Leaving after actual Furin display consumes delivery but remains an aborted
Furin outcome if no choice occurred. Horizon-only actual encounter consumes
delivery without requiring a choice; a normal end is delivered with no choice
required, not an aborted decision. Keep its real cleanup/exit reason separately;
a later cleanup failure does not erase acknowledged display or rearm its cap.
Never fabricate a continue/leave ACK. Prelude-only departure remains unserved and may be
attempted only at a later fresh valid opportunity, never a timer replay.

Renderer changes, tab switches, restarts or same-day goal edits do not rearm an
already delivered host/day. Activity-day rollover resets the cap; late prior-day
callbacks cannot mark the new day. Manual QA does not write production receipts.
The record retains the existing bound, exclusion from backup, analytics-reset
preservation and full-profile-reset ownership. V1 presence now rejects untouched
and requires the documented explicit development-profile reset. The former
one-shot session-shown transition is removed; those markers cannot prove actual
scoped delivery. `budget_horizon` is admitted storage vocabulary ready for P2,
with no active Horizon-only writer yet. Public changes require the explicit
versioned transition owner in the storage policy.

### 6.8 Active contract changes required with implementation

| Phase | Existing owner/contract | Required change |
| --- | --- | --- |
| P1-A | [Feed-flow runtime](feed-flow-runtime-target-architecture.md), `EnsoRuntimeEpisodeManager`, shared terminus and Furin entry owners | Shared purpose/phase seam; Furin-only demand; required prelude without periodic gate; narrow idle/cap/broad input/media commits to the screen evidence matrix |
| P1-A/B | [Intervention admission](intervention-admission-runtime.md), `InterventionAdmissionService`, content admission client | A: one composite lease, exact cleanup/occupancy. B: priority, relevant-policy revalidation/cancellation, whole-episode recovery and single cadence credit |
| P1-B | [Furin daily delivery](furin-daily-delivery-policy.md), `furinDailyPolicy`, dispatch/session owners | Scoped Global coverage, brief later Site delivery, generic site-end receipt, preserved actual evidence after edits and atomic real-display writes |
| P1-B | `ProtectionNudgeDispatchContext`, `ProtectionNudgeDispatchRunner` | Actual-attainment-only coalescing; no early Global substitution or false absorption; fresh policy/host/day validation at final authorization |
| P1-B/C and P2 | Typed storage and runtime snapshot contracts | B: exact daily receipt and goal-end/waiting projection; C: curve settings and snapshot; P2 Horizon writes the same daily owner; explicit public version transitions |
| P2 | Shared boundary coordinator and goal-end UI | Capability-selected final renderer; declaration-only goal end; no Furin-then-Horizon duplicate |

The linked Active contracts describe implemented P1-A/B owners and records.
P1-C adopts the settings, curve, envelope and derived-cache contracts in this
document. P2–P4 remain future work. Site support and human interaction evidence
remain release gates; each future slice updates its owning code, docs and guards.

### 6.9 Future hard stop

A hard stop is a closed threshold with nothing to decide. That is the Torii and
Shimenawa category, not a feed Horizon. It is placed in the Gate owner, modeled on
the return lock: `GateRuntimeStateOwner` holds a per-site lock with
`holdUntil = activity-day end`, admission treats it as mandatory, and the Zen
presentation is the Torii boundary. It is a per-site opt-in for later, never a
default, and needs its own decision and typed store row.

## 7. Shishi-odoshi interaction

- **v1: no per-entry target.** Shishi's entry and return rituals, entry approval,
  return lock and isolation are unchanged. The curve neither reads nor writes Gate
  state. Entering a site late in its budget lands directly at the current step,
  because prepaint matches.
- **Future option A: entry target (`이번엔 몇 분`).** A per-entry target would add a
  decision to an entry ritual whose current design is "waiting enters; pouring
  closes". It would compete with that ritual, so it stays out of v1. If adopted,
  it is a Shishi option owned by the Gate entry intent. The progress model would
  gain an explicit `basis: 'entry_session'` with declared precedence (for example
  the earlier of daily goal and entry target). It is never a hidden override.
- **Future option B: wait extension.** `gateShishiRitual.js` already has a frozen,
  bounded intensity extension for entry checkpoints. The curve step could feed it
  later. That changes ritual semantics and needs its own decision.

## 8. Guards and tests

Tests that protect durable contracts (per AGENTS verification cadence; no
incidental-UI contract tests):

| Test | Protects |
| --- | --- |
| `coolingCurvePolicy` shape | Exact keys and enums, integer ranges, absence → default, invalid presence rejects without rewrite, stored `globalFrictionLevel` rejects |
| Resolver/landing reference | Nominal standard windows follow the landing; tests separately assert the chosen quantized transition points (D8). No false exact-onset claim; landing build imports nothing from the extension. |
| Resolver properties | Monotonic in `p`; ≤ 17 distinct outputs per settings; user OFF never ON; strength ≤ 100; excluded children untouched; fixed mode identical to current output |
| Envelope composition | Curve with schedule relaxation, fullscreen suspension, global overrun and Global release/max-filter outcomes; Site Continue keeps plateau; no `policy_strengthening` or site `target_overrun` for curve-mode children |
| Explicit states | `no_budget` / `no_basis` carry reason codes; malformed inputs throw |
| Dispatch | A step change sends exactly one refresh per protected tab of the host. An unchanged step sends no `PROTECTION_UPDATE`. Activity-day rollover resets to step 0. Worker restart causes at most one re-evaluation. |
| Prepaint parity | Bootstrap at step N paints the same strengths as the post-bootstrap envelope |
| Required Furin boundary | Both Site and Global on a qualified feed require actual Horizon encounter and a fresh continuation before Furin; works with Barrier consumption interval OFF and fixed curve families; no periodic gate before Furin |
| Screen evidence matrix | Continuous/paged proof and current-item preservation; primary video cannot be ended by comment scroll/pause/other media; article bottom/idle/broad keys are not completion; unprepared native new-content action proceeds without replay; media-end mode does not create periodic Barrier reflection eligibility |
| Safe unsupported states | Unknown/unsafe feeds defer explicitly without guessed placement or timer overlay; declared non-feed entry preserves current content; goal state/plateau is independent of delivery |
| Goal edits and phase fencing | Increase/decrease/remove, recording/enable/protection revocation, day/reset-hour changes at reservation/attachment/encounter/final start; unrelated revisions retain valid work; combined binding cancels as a unit; exact cleanup and late callbacks cannot reopen cap or migrate day/document |
| Candidate priority and ownership | Unowned selection is Global -> Site -> periodic; an attached/displayed episode is not stolen or relabeled; exact cleanup and whole-episode recovery; no catch-up queue |
| Scoped Global coverage | Only actually reached and explicitly conveyed current-host goals combine; no near-Global early trigger; after Global, later distinct Site ends remain eligible and Furin is brief |
| Final renderer and daily cap | P1 prelude is not final delivery; P2 Horizon OR Furin, never both for one host/day; atomic real-display receipts, no fabricated Site evidence; restart, day rollover, late callbacks and goal edits do not duplicate delivery |
| Cadence accounting | Actual periodic/Furin end resets once; planned P2 final goal-boundary credit resets once; attachment/prelude-only cancellation does not reset; site usage never resets |
| Lightweight periodic flow | One compact choice or its accessible bounded-gesture alternative; no extra gate before Furin; native retreat/current-content behavior and arrival-input rejection remain |
| Nearby genuine goals | §6.5.2 cases: 15-second recovery inhibition, 60-second later independent goal, near-but-not-attained Global, current owner preservation and actual-only combined coverage; count exact final displays/credits without introducing a density timer |

New CI guard `check:protection:cooling-curve` (`scripts/ci/check-protection-cooling-curve.mjs`):

- Only `BudgetSnapshotReader` computes a usage/goal ratio.
- Only `coolingCurveResolver` creates `cooling_curve` modifiers.
- `src/domains/protection/content/**`, `src/domains/nudge/**` and `src/apps/content/**`
  import no stats, tracking time or curve-resolver module.
- `coolingCurve` is written only through the typed settings command.
- Every child of a curve family is bound to a slot or explicitly excluded.
- Budget/Furin purpose cannot manufacture an eligible Enso cadence receipt.
- Shared endpoint actuation has one owner; Furin-only configuration retains its
  declared boundary demand without enabling periodic Barrier effects.
- Goal-end receipt writes go through the single typed daily-policy writer;
  renderer-specific presentation evidence cannot stand in for another renderer.

QA: one named runtime-effect target with a synthetic stats fixture, declared in
`docs/operations/qa/entropy-qa-control-plane.md`, run through `npm run qa -- run`.
It checks step onset order on a real protected page. Extend the declared
intervention lifecycle/collision QA coverage for Furin-only prelude, safe entry,
priority and actual final-display receipts in P1, and Horizon-only delivery in
P2. Preserve synthetic-vs-natural evidence labels. No ad hoc browser automation.
Include the screen matrix's negative proofs, long-lived endpoint edits and the
close-goal cases in §6.5.2. P1-A/B focused synthetic owner/receipt tests have run,
including nearby millisecond candidate cases, cancellation and passive readout.
Named browser/site/restart targets and human interaction review remain pending;
unit results do not claim real-site support or natural-consumption evidence.

## 9. Phased plan

| Phase | Scope | Exit |
| --- | --- | --- |
| P0 | Close remaining decisions §10: curve settings/quantization, Global policy and lighter periodic UI; enumerate initial surface profiles against §6.2.1 and policy fences against §6.5.1 | Agreed direction, implementation evidence and remaining choices distinguished; affected Active contracts identified |
| **P1-A — shared boundary and safe Furin** | Extract the narrowly scoped shared episode lifecycle using existing admission; keep Site Furin; required Horizon before Site/Global Furin even with Barrier consumption interval OFF; screen capability/evidence matrix; narrow Furin action/media entry; lighter independent periodic interaction | Supported feeds preserve the current item and require encounter plus a fresh action; no extra Enso gate before Furin; unsupported/mixed pages wait explicitly; safe-entry and cleanup checks pass |
| **P1-B — arbitration, cancellation and records** (after A) | Global -> Site -> periodic new selection; phase/current-policy/day revalidation and exact cancellation (§6.5.1); scoped Global coverage and actual-only coalescing; single typed daily site-end writer; whole-episode recovery/cadence credit; P1 visible waiting status and goal-end snapshot | Goal edits cannot start stale Furin; unrelated edits retain valid work; long-lived/restarted/multi-tab episodes cannot duplicate or migrate delivery; close-goal scenarios and honest receipts verified |
| **P1-C — curve, settings and prepaint** (after B) | `coolingCurve` contract, typed commands and public Settings Protection preset (D1); presets/bindings/resolver and D8 quantization; modifier composition; tracking-step refresh and prepaint parity; Tools family modes; explicit no-budget/no-basis and Global override readout; final landing disclosure | Staged onset/plateau match the chosen numerical contract; Site Continue does not reset it; fixed mode/disabled effects and independent Enso remain correct; matching structural guards/checks pass |
| P2 | Capability-selected site end: Budget Horizon OR Site Furin (§6.3), using the same daily owner; final Horizon credit policy; Sites notebook and popup progress | One actual site-goal end per host/day; no Furin-then-Horizon repeat; supported-feed and unsupported-state disclosure is accurate |
| P3 | Advanced editor (writes `advanced`); preset preview curve | No storage transition needed |
| P4 | Optional: hard stop (Torii lock), Shishi options A/B, break relief, global-goal participation | Each needs its own decision |

P1-A -> P1-B -> P1-C are sequential, independently reviewable implementation
slices of one pre-launch P1, not three partial product launches. A uses existing
admission/daily owners; B supplies the full new policy and receipt contract before
C connects the curve. Do not introduce temporary parallel runtime owners,
legacy-read paths or fallback actuation between slices. Affected code, Active
contracts and guards change together in their owning slice. The complete P1
release gate requires all three exits, the declared initial support evidence and
accurate phase disclosure; A or B alone does not ship or advertise a cooling cycle.

P1-A's shared coordinator remains limited to placement/entry/cleanup. Background
budget and admission owners retain eligibility, priority and cancellation
authority; the typed daily writer retains durable caps. P1-B close-goal review
may identify a separate later density-policy decision, but does not authorize a
new clock or speculative Global coverage.

## 10. Decisions and remaining choices

The user agreed to the P1/P2 end direction, separate periodic Barrier reflection
and mandatory Horizon-before-Furin on 2026-10-13. P1-B implements scoped Global
delivery and goal-policy cancellation; P1-C implements the settings and curve
decisions below. The user explicitly selected the existing 16-step floor formula.
P2 final-Horizon credit and the lighter periodic interaction remain proposed.

| ID | Question | Adopted P1 decision / later scope |
| --- | --- | --- |
| D1 | Fold `globalFrictionLevel` (1–5) and the Filter degree selector into `coolingCurve.preset`, deriving posture from it? | Yes. One 3-way knob. Pre-release removal plus dev-profile reset. |
| D2 | Time basis: recording-admitted stats `active` (matches Sites and Furin) or a new consent-independent per-site operational accumulator (like Enso)? | Stats `active` for v1. Revisit if recording-off users need the curve. |
| D3 | Curve-mode family with no goal or no basis: fixed strength, or inactive? | Fixed, with a visible reason. |
| D4 | Default family modes (Brake `fixed`?) and excluded children list | As in §4.2 and §4.4 |
| D5 | Fixed slots or compaction when earlier slots are empty? | Fixed |
| D6 | Goal ends, shared boundary, independent periodic choice and lifecycle | **Direction agreed:** P1 Site Furin; required Horizon before Site/Global Furin on supported feeds even with Enso OFF; P2 one Horizon-or-Furin site end. Detailed choices below. Furin-then-separate-Budget-Horizon is rejected. |
| D7 | Should the global goal also drive the curve (for example `max(siteRatio, globalRatio)`)? | No in v1. The global overrun +1 stays. |
| D8 | Preset numbers, quantized onset contract and Korean labels | Adopted 16-step floor formula (§4.3). Standard's actual first tint is 26.875% and final approach is 95.125%; nominal reference windows remain documented separately. Labels 부드럽게 / 표준 / 가파르게. |
| D9 | Break relief: should observed departure (10-min boundary) cool the curve back? | No in v1 (daily budget semantics) |
| D10 | Name: "cooling cycle" (product) and "cooling curve" (runtime) | Keep both: cycle = the daily experience, curve = the law |

D6 detail:

| Item | State | Direction / remaining decision |
| --- | --- | --- |
| D6a — Purpose and phase separation | Agreed direction | One shared boundary, explicit periodic/Site/Global purpose; required prelude -> Furin under one lease; no periodic Gesture Gate before Furin |
| D6b — Global and Site delivery | Implemented P1-B policy | Removed whole-day future-Site suppression; later Site Furin is brief; only both actually reached current-host goals combine, with explicit copy and actual V2 receipts |
| D6c — Priority and records | Implemented P1-B owners; runtime/experience review remains | Global -> Site -> periodic at new selection with a fenced optional-periodic priority read; preserve existing owners; separate attainment, attachment, exposure, final delivery and choice ACK (§6.5–6.7) |
| D6d — Periodic interaction | Lightweight role agreed; exact UI open | Prefer one compact finish/continue choice; gesture is an accessible bounded alternative with less burden than brief Furin, never an extra gate; retain independent Off/8/12/20 control |
| D6e — P2 goal-Horizon cadence credit | Proposed P2 policy | Actual final Horizon encounter/end earns one explicit goal-boundary credit; no credit for attachment or Furin prelude alone; do not forge an Enso reflection receipt |
| D6f — Coverage and final routing | Evidence contract specified; per-surface proof pending | Apply §6.2.1 screen matrix and visible P1 waiting state; narrow existing seam in P1-A. Initial profiles still need actual verification; P2 qualified site feed normally uses Horizon-only. |
| D6g — Goal edits and cancellation | P1-B owners implemented; phase/runtime verification remains explicit | Revalidate at ingress and phase transitions (§6.5.1); relevant changes retain exact cancelling ownership until cleanup, unrelated changes do not cancel; delivered caps survive edits and old callbacks never acquire new day/document authority |
| D6h — Nearby goals | Synthetic nearby-candidate/receipt cases verified; browser/experience review pending; no density policy adopted | Run §6.5.2 site/restart/experience scenarios; preserve actual-attainment-only coalescing, recovery/fresh-boundary rules and accurate receipts |

The landing must disclose phase-specific final presentation, support limits and
compressed time. P1's required Furin prelude is real, but its declarative
Horizon-only site ending is still a landing presentation until P2. Even P2 does
not justify a claim that every site has an endpoint or that continued use is
blocked.
