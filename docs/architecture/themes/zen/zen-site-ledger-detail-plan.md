# Zen Site Ledger Detail Plan

- Status: Draft
- Owner: zen theme / sites detail presentation (UI); stats domain query (data seams)
- Last validated against code: 2026-10-11
- Last updated: 2026-10-11
- Path policy: planning-allowed
- Canonical for: the redesign direction of the Zen 길목 장부 → selected-domain detail screen, and the data seams it requires

> Current revision: §13 supersedes the spread, full-height exclusion and nested reading flow in §§4/12. Earlier mock exports and QA results remain historical evidence, not acceptance of the new screen.

## 1. Why

The pre-P3 detail screen always rendered
three fixed observation cells (way / rhythm / change) and labelled the session shape with one
form (`short_repeated` / `long_repeated` / `mixed_repeated`). This has three problems:

1. Fixed slots must be filled, so an empty or single result looks broken or gets padded.
2. A single "form" label forces a distribution of features that can coexist or appear alone.
3. Evidence lives in a separate reading view, away from the summary, and nothing accumulates
   visually from day 1 to day 30.

The new direction replaces the slots with **one ledger surface that grows one row per day**
and **annotations (주석) that appear only when a criterion is met**.

## 2. Reference material

- `.artifacts/zen-site-ledger-detail/screens/` — exported images of the six canvas boards
  (① first day, ② 5 recorded days, ③ accumulated with several features, ④ evidence state,
  ⑤ accumulated with one feature, ⑥ accumulated with none). **These are the visual target.**
- `.artifacts/zen-site-ledger-detail/mock/Main.dc.html` — the mock source.
  **Mock-only.** Its numbers are fabricated, and its JS recomputes the admission criteria
  only so the mock is internally consistent. Do **not** port that logic into UI code: the
  producer owns every judgment (see §8). Its colors and fonts are also mock-only (see §4.7).

## 3. Principles

1. **One ledger, growing.** One row = one calendar day, 00–24h, one cell per hour; cell ink
   density = recorded active time in that hour. Day 1 shows only today's row (large); day 30
   shows 30 rows. There is no separate "not enough data" screen.
2. **Interpretation is annotation, not type.** Each admitted pattern is one annotation, in
   the producer's order. Zero, one or three annotations use the same grammar. No slots, no
   "representative type", no form label.
3. **One denominator.** Every pattern annotation reads `n / N일` where N = active days in the
   window. Values never sum to 100 %, so coexisting features are not distributed. Overlap is
   visible as two marks on the same row in the gutter.
4. **Evidence on the same surface.** Selecting an annotation dims non-matching rows, highlights
   matching rows/hours and switches the row-end value to that criterion's measure, so a
   non-matching day shows why it did not match. Selecting a row opens that day's slip.
5. **Words.** Never "습관 / 패턴 / 자주". Always a number with its denominator and an explicit
   scope (오늘 / 지난 30일 / 오늘 제외). Missing ≠ observed zero ≠ in-progress today.

## 4. Screen anatomy (reading order)

### 4.1 Spread and Zen material

- Two-page spread over the pond: left page = the existing ledger list (selected row marked),
  right page = this domain. On narrow widths the pages stack.
- The bonsai canopy keeps invading the right page's top-right corner (existing identity).
  Content must stay outside the occluded region using the existing ink-width mechanism
  (`--zen-ledger-ink-width` / `--zen-ledger-inset`), not by hiding the canopy. In the mock,
  header/today/annotation blocks are capped (~520–600 px) and the ledger field starts below
  the canopy, so it can use the full width.
- The mock's pond, koi and bonsai drawings are illustrations; the real scene already exists.

### 4.2 Header

Domain (serif), policy/recording state line (existing labels).

### 4.3 Today line

`오늘 {N}분`, the recorded-range text, completed-session count, and the existing
`siteCapControl` (keep its current owner). See §9 for the activity-day vs calendar-day issue.

### 4.4 Annotations (주석)

Section title + scope line, then a list of buttons. Each annotation:

| Part | Content |
| --- | --- |
| Glyph | one small mark per annotation kind (also used in the ledger gutter) |
| Label | short noun phrase (serif, ~18 px) |
| Definition | the criterion in plain words, always visible (muted, ~11.5 px) |
| Number | large `n` + `/ N일` (or unit), caption under it |

Glyphs: short sessions = three dots, long sessions = one bar, recurring time = two vertical
bars, change = two offset strokes, re-entry = return arrow, friction = ring with dot,
longest session = hollow bar. Shape differs per kind (do not rely on color alone).

Below the list, a constant line explains what is checked (see copy table).

### 4.5 Ledger field (날마다 한 줄)

Grid per row: `date (58px) | gutter | 24 hour cells (1fr) | value (96px)`.

- **Gutter**: one 14 px column per *admitted* pattern annotation, in annotation order
  (`n×14 + (n−1)×4` px; 0 px when none). A row shows the pattern glyph when its date is in
  that pattern's `matchedDates`.
- **Cells**: ink alpha `0.16 + 0.8 × min(1, minutes / 30)`; empty hour = faint track only.
- **Row kinds**:
  - observed with use: cells
  - observed zero: track only, no ink (reads as "recorded, nothing")
  - missing (`observed=false`): no track, a dotted line, value `기록 없음`
  - leading consecutive missing run (before the first observed date in the window): collapse
    into **one** row labelled `{start}–{end} · 기록 없음 {n}일`. Do not claim "before install".
  - today: last row, separated by a dashed rule, warm ink, a "now" marker, value
    `{N}분 기록 중`; never marked in the gutter, never part of averages or annotations.
- **Average row** (top, under the hour axis, double rule below): per-hour
  `hourly[].averageActiveMs`, label `평균 · 기록 {n}일`, value `평균 {m}분`.
- **Row order**: oldest at top → today at bottom (ledger writing order). See §9.
- **Row height**: ~11 px past rows, ~16 px today; on day 1 today is ~40 px with per-hour
  minute labels under the cells and 3-hour axis ticks.

### 4.6 Focus behavior

| Selected annotation | Rows | Cells | Row-end value (header) |
| --- | --- | --- | --- |
| none | all normal | ink | `{min}분` (`하루`) |
| short sessions | matched full, other active dimmed (~0.32), zero/missing ~0.5 | ink | `{short} / {count}` (`2분 미만 / 마친`) |
| long sessions | same | ink | longest session `{m}분` (`가장 긴 이용`) |
| recurring time | same | window columns get a band; matched rows' window ink turns moss | `{windowMin}분 · {share}%` (`{s}–{e}시 · 비율`) |
| change | all normal | ink | `{min}분`; a divider between the two halves with `↑/↓ {range} · 기록 {n}일 · 평균 {m}분` |
| today notes (day 1) | today row | the producer's window gets a band | per note |

A recurring window with `wrapsMidnight=true` must band two segments.

### 4.7 Day slip

Opens under the field for the selected row: date + weekday, minutes, completed sessions,
`2분 미만 / 2–20분 / 20분 이상`, longest session, window minutes and share when a recurring
window exists, then `이 날 해당한 주석` with glyphs. Missing / zero / today / matched-nothing
each get their own sentence (copy table). Close button ≥ 44 px.

### 4.8 Basis footnote

Collapsed `이 장부를 읽는 기준`; content in the copy table.

### 4.9 Styling rules for implementation

- Use Zen tokens and the existing `--intel-*` variables (`--intel-ink`, `--intel-muted`,
  `--intel-rule`, `--intel-mark`, `--intel-reference`); the mock hexes are references only.
- Typography through L2 (`--font-theme-serif`, `--font-theme-ui`); no new font faces and no
  `font-family` inside `[data-theme=...]` rules (AGENTS.md §5).
- Touch targets ≥ 44 px for annotation buttons, rows on coarse pointers, slip close, basis.
- Rows are real `<button>`s with an `aria-label` like `9.26 토요일 · 41분`; annotations use
  `aria-pressed`; the field is a labelled group.

## 5. States

| State | Source | Shows |
| --- | --- | --- |
| first day (no completed observed day) | `longTermPatterns.status` `missing`/no observed days | today line, today notes (§6 producer), today row only, the "how the ledger grows" sentence |
| early (`insufficient_history`) | observed < 7 or active < 4 | pooled counts as counts (no "반복"), rows so far, status line with current counts |
| accumulated, 1–3 patterns | `available` | pattern annotations in producer order + change if available |
| accumulated, none | `unclassified` | lead sentence "no repetition reached the criteria", change if available, full ledger |
| change unavailable | `observations.change.available=false` | no change annotation (no placeholder) |
| `observed_zero` | all observed days zero | ledger with zero rows; no annotations |
| `detail_not_loaded` | analysis tier | explicit loading/unavailable state; never an empty ledger |

## 6. Data mapping

| UI element | Source (current names) |
| --- | --- |
| today number | loaded `intel.todayTotal` (**calendar-day basis**, matching the row); a pending snapshot is separately labelled activity-day usage (§9) |
| today row cells | `intel.todayHourly` (calendar day) |
| today notes | `intel.todayNotes` (C3): validated terminal facts in producer order; never format a note by rebuilding it from raw families |
| today-note source facts | calendar-day `todayTotal`, `todayHourly`, `todayVisits`, `todaySessionStats` {count, shortCount, longCount, totalMs, maxMs}, `todayBehaviorStats.revisitWithin5m`, `todayInterventionStats` {frictionShown, continued, left}; the activity-day usage projection is not a source |
| past rows | `longTermPatterns.days[]` {dateStr, observed, activeMs, sessionCount, shortSessionCount, longSessionCount, maxSessionMs} + **C1** |
| average row | `longTermPatterns.hourly[].averageActiveMs`, `period.observedDayCount` |
| pattern annotations | `longTermPatterns.patterns[]` in given order: `id`, `repeatedDayCount`, `activeDayCount`, `matchedDates`; recurring window `startHour`, `durationHours`, `endHourExclusive`, `wrapsMidnight` |
| recurring row values | **C2** |
| change annotation / divider | `observations.change` {available, reference, recent} |
| early pooled counts | `observations.way` {sessionCount, shortSessionCount, maxSessionMs} |
| scope line | `period` {startDateStr, endDateStr, observedDayCount, activeDayCount} |
| criteria text | `longTermPatterns.criteria` (format from it; do not hard-code numbers twice) |

## 7. Required data changes

- **C1 — per-day hourly activity.** `buildDay` already computes `hours`, but
  `buildSitesSiteLongTermPatterns` drops them (`days.map(({ hours, ...day }) => day)`).
  Publish `days[].hourlyActiveMs: number[24]` (`null` when `observed=false`). Bump
  `SITE_LONG_TERM_PATTERNS_VERSION` to `sites-site-long-term-patterns-v2`;
  `requireSiteLongTermPatterns` validates length 24,
  non-negative, sum equals `activeMs` (same tolerance as existing checks), null iff unobserved.
  No new collection or storage.
- **C2 — per-day recurring-window measure.** When a `recurring_time` pattern exists, publish
  per day `recurringWindow: { activeMs, share } | null` computed by the producer with the same
  rule it uses for admission, so the UI never re-evaluates the window.
  Without an admitted recurring-time pattern, every day's value is `null`. With a pattern,
  unobserved days remain `null`; observed days contain the circular window's active-time sum
  and its ratio to that day's active time. An observed zero-use day contains
  `{ activeMs: 0, share: null }`: the zero-denominator ratio is unavailable, not zero.
  The contract validates the sum against `hourlyActiveMs` and the ratio against `activeMs`.
- **C3 — today facts producer (P2 implemented).**
  `src/domains/stats/background/query/statsSiteTodayNotes.js` owns
  `buildSitesSiteTodayNotes(intel)`; `siteTodayNotesContract.js` owns the public
  `sites-site-today-notes-v1` contract. FULL selected detail publishes `intel.todayNotes`;
  SUMMARY and ANALYSIS publish the explicit unloaded shape. This is terminal display output,
  not a classifier, baseline or feature input. No collection, storage or setting is added.
  - DTO: `{ version, basis: 'local-calendar-day-hour', status, dateStr, notes }`.
    `detail_not_loaded` has `dateStr: null` and `notes: []`. Loaded `missing` and
    `observed` use the validated current local date. Missing observation has no notes;
    observed zero also has no notes but keeps `status: 'observed'`.
  - Notes: `{ id, value, denominator, unit, source, window?, responses? }`.
    They are an ordered, unique subset of `short_sessions`, `peak_time_window`,
    `revisit_within_5m`, `friction_response`. Only strictly positive denominators admit a
    family; a measured zero numerator remains zero. The UI formats this order and does
    not select or rank families.
  - `short_sessions`: count from `todaySessionStats.shortCount`, denominator completed
    `todaySessionStats.count`, `unit: 'count'`. Sessions belong to their completion date
    and retain their full duration. `maxMs` may exceed this calendar day's `todayTotal`;
    it is bounded by session `totalMs`, not the active-time total.
  - `peak_time_window`: milliseconds from `todayHourly`, denominator calendar-day
    `todayTotal`, `unit: 'duration_ms'`. The producer selects adjacent hours in this same
    date: `window: { startHour: 0..22, durationHours: 2, endHourExclusive: startHour + 2,
    wrapsMidnight: false }`. It never joins 23:00 with 00:00; equal sums retain the
    earliest start. All-zero hours omit the note. Hourly values must sum to `todayTotal`
    within the existing 0.001 ms tolerance; neither value reads activity-day usage.
  - `revisit_within_5m`: count from `todayBehaviorStats.revisitWithin5m`, denominator
    `todayVisits`, `unit: 'count'`. This measures previous visit start → next visit start
    at an interval of at most five minutes, including admitted background-tab visits.
    It does **not** measure an exit → return gap or establish time away from the site.
  - `friction_response`: `value` and `denominator` both equal positive `frictionShown`,
    `unit: 'count'`, source `todayInterventionStats`, with `responses: { continued, left }`.
    Shown/continued/left are independent event-date counters, not an exposure-linked
    cohort, partition or response share. `frictionShown: 0` with a positive response is
    valid and produces no friction note. Responses may exceed the shown count; no sum
    or share relation is inferred.
  - Missing or invalid raw fields fail with `SITE_TODAY_NOTES_SOURCE_INVALID`; an invalid
    public DTO fails with `SITE_TODAY_NOTES_CONTRACT_INVALID`. No defaulting, alternate
    source or silent repair is allowed.
- Leading-missing collapse (§4.5) is presentation only and needs no contract change.

## 8. Prohibitions

- UI must not compute admission, rank patterns, pick a primary, or re-label a form. The
  producer order is the display order. `observations.way.form` is no longer displayed.
- No values that look like a distribution (percent split, stacked share of "types").
- Missing is never shown or averaged as 0. Today is never in historical pattern
  annotations, gutter or averages; first-day terminal today notes remain a separate scope.
- No fallback paths: if C1/C2/C3 data is absent or invalid, fail through the existing
  `SiteIntelBoundary` diagnosable state (AGENTS.md §7). No `??` defaults at the boundary.
- No new storage keys, collection, or settings.
- Do not add UI contract tests for visual specifics or copy (AGENTS.md §8). Protect the data
  contracts (C1–C3) and durable flows (select annotation → evidence, select row → slip).
- Do not start a dev server automatically.

## 9. P3 decisions and remaining visual work

These implementation decisions qualify the visual target in §4. They do not change
the historical admission criteria, pattern order or C1–C3 data contracts.

1. **Today and cap bases.** The loaded headline and today row both use calendar-day
   `intel.todayTotal`, with the 00–24h basis visible. The existing cap still uses the
   reset-hour activity day and states that separate interval. A pending detail query
   may show the independent registry usage snapshot only with its activity-day label;
   it does not supply today cells or notes. Cap editing retains its existing owner.
2. **Today row position.** Today stays at the bottom, after the completed dates.
   Leading missing dates collapse only before the first observed date; a first-day
   reading shows only today's row. Missing, observed zero and in-progress today remain
   separate states.
3. **Narrow widths.** Keep all 24 hourly cells and reduce date/value/gutter spacing.
   Do not aggregate into eight cells or change the source hourly values. Mouse rows
   use a readable 12px font and 17px minimum height instead of the mock's ~11px rows;
   row targets on coarse pointers are at least 44px.
4. **Friction wording.** Use `멈춤 화면` with the independent event-date response copy
   in §11. Do not imply that continued/left partition the shown count.
5. **No fabricated now marker.** The current contracts contain no canonical query
   timestamp suitable for the marker shown in the mock. Omit it instead of reading
   the UI wall clock or implying a measured recording endpoint.
6. **Early pooled counts.** `observations.way` pools completed sessions across all
   observed dates, including recorded zero-active-time dates. The early annotation
   names the observed-day count, not the active-day count. It remains a count, with
   no repeated-day admission inferred by the UI.
7. **Canopy and scrolling.** The Garden canopy is a fixed sibling of the scrolling
   Sites document. A full-width field placed below it can scroll back under it.
   P3 therefore keeps the field, slip, basis, text and click targets within the same
   horizontal ink exclusion as the upper reading, using the existing immutable
   full-history canopy receipt. This deliberately differs from §4.1's full-width
   field target. Do not reserve an arbitrary fixed-height blank area: the current
   receipt exposes only horizontal extent, and whole-tree bottom bounds include
   the trunk/root. Widening the field requires a future, canonical viewport paint
   overlap geometry that protects it throughout scrolling, not only at entry.
8. **Spread and owners.** Zen alone binds the existing registry and selected notebook
   into a two-page spread, stacking at narrow widths. Bonsai scale/position are not
   changed. The registry, selected-detail query, `SiteIntelBoundary` and cap command
   owners are reused; the spread introduces no business-data cache or storage.
9. **Recurring-day definition.** Locale copy states the existing five-minute and
   40% recurring-window day criteria. Formatting that definition does not run the
   admission rule, choose a window or change the producer.
10. **Cleanup boundary.** P4 removes the disconnected three-axis/separate-reading
    implementation, its isolated helpers and unused locale keys after checking
    shared and other-theme consumers. The ledger owners below remain canonical.
11. **Evidence precision.** Criterion evidence uses whole seconds and percentages
    truncated to one decimal place, so 19m50s cannot appear to meet 20 minutes and
    39.99% cannot appear to meet 40%. General daily totals retain minute summaries.
    A wrap-midnight window names both segments of the same calendar date; it does
    not imply a following-day visit. Pause-screen counts keep event units.
12. **Cap editing footprint.** Zen's loaded notebook opts the existing cap owner
    into an anchored editor. The saved-value trigger stays in place while editing,
    so the field and annotations do not move to accommodate the form. Cancel and
    Escape retain the existing draft cancellation and focus-return behavior.
13. **Reopened height acceptance.** The user requires a canvas that fits without
    document scrolling. The current normal-flow document does not meet this:
    annotations, all dates, the slip and basis accumulate vertically. The target
    PNGs are auto-height design boards, not proof of viewport fit. The responsive
    follow-up below distinguishes successful reachability assertions from this
    unmet requirement. A fixed canvas needs bounded reading states that replace
    content within the same area; hiding overflow or shrinking text is not a fix.

14. **Bounded canvas follow-up (2026-10-11).** The user approved preserving the
    material, typography and bonsai size while replacing detail within one fixed
    region. Overview, annotation evidence/daily history, selected-day slip and
    reading guide are mutually exclusive bodies below the persistent identity.
    Today/cap is the overview's first page item, so it does not take space away
    from the selected evidence or day. The inactive overview remains mounted,
    hidden and inert to preserve the cap editor's draft, ACK and success timer.
    The existing annotation grammar and producer ordering remain.
    Actual rendered item heights and available body height determine page breaks;
    all 24 hours and every date remain accessible. Hidden page items are inert and
    excluded from the accessibility tree. Slip facts use short same-area sections.
    The current body, previous body, selected annotation/date and page anchors are
    domain-scoped presentation intent, retained through query withdrawal without
    retaining business DTOs. Escape and app-owned mouse Back unwind an inner body
    before the notebook. Narrow selected notebooks hide the redundant registry;
    notebook Back restores the retained index. The existing cap owner positions
    its complete anchored form within actual paper/ink bounds. No bonsai geometry,
    stats criteria, query owner, collection, storage key or setting changes.

## 10. Phases

| Phase | Scope | Done when |
| --- | --- | --- |
| P1 | C1 + C2 in `statsSiteLongTermPatterns.js` and `siteLongTermPatternContract.js` (implemented) | contract validates new fields; producer tests cover observed/zero/missing days, wrap-midnight window; consumers listed |
| P2 | C3 today facts producer (implemented) | v1 terminal notes in FULL; SUMMARY/ANALYSIS unloaded; ordered subset from validated calendar-day facts; positive denominators only; window chosen in producer; tests |
| P3 | Complete: ledger + annotations + slip in `src/themes/plugins/zen/widgets/sites/`, sites locale and Zen-only existing-workspace spread; 155 focused tests and static guards passed; canonical browser QA passed all 14 source fixtures at each of three viewports, with final scrollbar material rechecked at desktop-wide | all §5 states render; §4.6 focus behavior; target visual grammar with the explicit §9 decisions; existing `SiteIntelBoundary` and cap control kept |
| P4 | Implementation complete: remove disconnected axis/graph/reading components, isolated registry/formatting helpers, the unused clock-color projector and their unused locale keys | consumer tracing complete; final P4 verification recorded below |

P3 implementation owners are `ZenSiteUsageReading`, `ZenSiteLedgerAnnotations`,
`ZenSiteLedgerField`, `ZenSiteDaySlip`, `ZenSiteLedgerGlyph` and
`zenSiteLedgerFormat`. Annotation focus, selected date and the native basis disclosure
are domain-scoped presentation intent. Selecting a note changes evidence on the same
surface; selecting a date opens its slip in normal flow. Escape closes the slip and
returns focus to its date row before clearing annotation focus. None of this feeds
back into stats judgment or persists business data.

The implementation covers first-day, early, admitted-pattern, unclassified,
observed-zero and explicit unloaded/missing states. Canonical source-fixture browser
journeys now verify the covered presentation paths at all three named viewports.
This does not certify live collection, production release or exact visual parity
with every mock detail; the §9 decisions remain explicit. P4 removes the disconnected
implementation without changing the P3 presentation or data contracts.

### P4 cleanup record (2026-10-11)

Consumer tracing covered tracked and untracked source, scripts and tests, including
dynamic translation-key families. Cleanup removes nine source files and the
dedicated graph stylesheet. Shared hourly navigation, analytical pattern names,
sub-minute formatting and Matrix's unavailable-record copy remain supported.

The authored Sites resources remove 140 unused keys per locale (280 across Korean
and English). Generated runtime modules are synchronized through
`npm run i18n:sync:modules`; no alternate locale owner or generated-only patch is
introduced. The ledger's criteria, producer order, C1–C3 contracts and retained
query/command owners are unchanged.

P4 verification (2026-10-11):

- `npm run test:file -- tests/zenSiteIntelResilience.test.jsx tests/zenSiteLedgerFormat.test.js tests/siteIntelPresentation.test.jsx tests/siteIntelHourlyContext.test.js tests/zenRegistryPanel.test.jsx tests/sitesRegistryThemeContract.test.jsx tests/dashboardSitesRecordingJourney.test.js`: initially **136/137 passed**. The single failure was an obsolete registry-test expectation for the protection-registration action, not a changed command path. After matching the mock and assertion to the current accessible name, `npm run test:file -- tests/zenRegistryPanel.test.jsx` passed **3/3**; all **137 focused cases across the seven files** then had passing results.
- `npm run i18n:sync:modules`, `npm run check:i18n:contract`,
  `npm run check:dashboard:i18n-contract`,
  `npm run check:theme-public-entry-boundaries`, `npm run check:qa:architecture`,
  `npm run check:docs:paths` and scoped `git diff --check` passed.
  `node --check` also passed for `dashboardSitesIntelJourney.mjs`,
  `dashboardSitesRecordingJourney.mjs` and `check-theme-seam-role-architecture.mjs`.
- `npm run check:theme-seam-role-architecture` failed on the existing
  `ArtifactGalleryView.jsx` horizon-incision requirement. `npm run
  check:i18n:dynamic-families` failed on missing Korean/English
  `dashboard.garden` navigation/title/description keys. Both concern other dirty
  work outside this cleanup; P4 does not weaken the guards or repair those changes.
- `node scripts/lint.mjs src/themes/core/widgets/shared/sites/index.js src/themes/plugins/zen/widgets/sites/ZenTargetPanel.jsx` passed.
- Closing retention inspection found one eligible completed run (2,959,924 bytes).
  `npm run qa -- retention prune` removed that run through its owning lifecycle;
  all 286 protected runs were preserved. Remaining evidence was 2,164,868,163 bytes,
  still above the 2,147,483,648-byte budget (`BUDGET_EXCEEDED`). This is retention
  administration, not a new browser QA result.
- No full test suite, extension build, browser QA or dev server was run for P4.
  The existing `dist` publication remains the P3 build; the P3 browser receipts
  below do not claim a fresh P4 artifact or browser run.

### P4 verification follow-up (2026-10-11)

The two static failures in the initial P4 record are resolved at their owning
guards. The theme-seam guard now verifies the gallery controller and the extracted
`ArtifactHorizonIndex` against their separate responsibilities, including keyboard
navigation and locked/non-actionable entries. The i18n dynamic-family guard reads
the actual dashboard-tab metadata declarations instead of assuming every
`dashboard.*` copy group is a tab; `dashboard.garden` remains garden-action copy.
It still checks locale parity and requires every declared tab copy leaf.

- `npm run check:theme-seam-role-architecture`,
  `npm run check:i18n:dynamic-families`, `npm run check:i18n:contract`,
  `npm run check:qa:architecture`, `npm run check:docs:paths` and scoped
  `git diff --check`: **passed**.
- `npm run test:file -- tests/dashboardTabMetadataContract.test.js`: **11/11 passed**.
  `npm run test:file:fast -- tests/artifactHorizonIndex.test.jsx`: **passed**.
- `npm run i18n:sync:modules` and `npm run build`: **passed**. The canonical
  development publisher produced build `20261011091955-42cb4a5944f0-dirty`
  in `dist`, from input digest
  `a12544bc1c10d1dc333996197a2ac72d0d71cfc574be54dbe40f975be5939c28`.
  Artifact closure checks passed. No production/release build or full test suite
  was run.
- Initial retention inspection found 317 runs, no eligible deletion candidates and
  2,164,868,163 bytes against the 2,147,483,648-byte budget. The operator explicitly
  authorized deleting the six superseded October 5 UI receipts listed in
  `.artifacts/zen-site-ledger-detail/P4-retention-review.md`. Canonical
  `qa retention unpin` for each exact ID, inspection of the six candidates and
  `qa retention prune` deleted only those six runs (52,018,498 bytes after removing
  pin metadata), leaving 2,112,848,003 bytes. Research pins, the current P3 baseline,
  incomplete runs and browser profiles were preserved.
- `npm run qa -- run dashboard/capture --surface=sites --sites-scenario=intel-reading --theme=zen --presentation=hidden --viewport=desktop-wide`:
  **PASS**, exact run `20261011092746083-dashboard-capture-25a57b7b`.
  All 14 source fixtures passed, including first-day, zero, missing and accumulated
  records. Annotation/field interactions, date slips/Escape, basis disclosure,
  cap-editor access and registry/detail return and reopening passed. Final navigation checked
  43/43 controls, no failed scroll checks and no clipped notebook content.
- `npm run qa -- run dashboard/capture --surface=sites --sites-scenario=recording-refresh --theme=zen --presentation=hidden --viewport=desktop-wide`:
  **PASS**, exact run `20261011092839554-dashboard-capture-cf583c4d`.
  A 65-second observation received a newer snapshot. Reset-hour invalidation then
  moved through ready/loading/ready while preserving scrollTop 194, today's
  selected row and open slip, and the open basis disclosure. The global-cap draft,
  focus/cancel and current-policy/consent-withdrawal checks passed. This fixture
  had no available annotation (`annotation: null`), so that live refresh does not
  certify restoration of a selected non-empty annotation's field projection.
- Both runs reused the exact development build and digest above with
  `sourceSnapshotChanged: false`. They ran headless in the declared isolated
  `ephemeral` environment; no personal profile or dev server was used. App runtime
  exceptions, console errors/warnings and CSP violations were **0**, health was
  clean, and each cleanup released **7/7** resources with a terminal completed
  recovery journal. The report's active-process count is unavailable; no global
  zero-process claim is made. Chrome stderr retained non-fatal Windows sandbox
  access/network-service-restart messages in both runs and deprecated GCM-endpoint
  messages in the recording run; these are separate from the clean app logs.
- Direct image inspection covered first-day, mixed date slip, site cap editing
  and the global-cap draft. Text and numbers remained outside bonsai occlusion.
  P4 did not change geometry, so the earlier P3 narrow/low receipts remain
  historical layout coverage; only desktop-wide was rerun for this cleanup.
  The source-fixture journey does not certify collection/model accuracy, and the
  recording journey generated no foreground usage. No release certification is
  claimed.
- Both new PASS receipts are pinned with explicit P4 reasons. Closing canonical
  retention inspection found 313 runs, no candidates, 282 protected runs and
  2,146,013,552 bytes within the 2,147,483,648-byte budget; the closing prune
  deleted no further runs.

### Responsive QA and reopened canvas requirement (2026-10-11)

The current development artifact was checked with both commands below:

```powershell
npm run qa -- run dashboard/capture --surface=sites --sites-scenario=intel-reading --theme=zen --presentation=hidden --viewport=portrait-narrow
npm run qa -- run dashboard/capture --surface=sites --sites-scenario=intel-reading --theme=zen --presentation=hidden --viewport=desktop-low
```

| Viewport | Exact run | Visible Sites height | First-day / mixed document height | Recorded verdict |
| --- | --- | ---: | ---: | --- |
| 560 × 960, portrait-narrow | `20261011094539598-dashboard-capture-e5795e14` | 403px | 1,196px / 1,817px | FAIL |
| 1440 × 720, desktop-low | `20261011094928174-dashboard-capture-cb9d84c8` | 612px | 1,205px / 1,840px | FAIL |

Both runs reused build `20261011091955-42cb4a5944f0-dirty` and input digest
`a12544bc1c10d1dc333996197a2ac72d0d71cfc574be54dbe40f975be5939c28`.
They captured all 14 source cases. In those captures, no source had a failed
horizontal-overflow, scroll-reachability or control-reachability assertion.
Runtime exceptions and app console errors/warnings were zero. These observations
do not change either recorded FAIL into a PASS.

Both failed final boot health with `QA_DASHBOARD_CAPTURE_BOOT_HEALTH_FAILED`:
`mainTabFirstFrameWaitBudgetExceeded` was true despite the page subsequently
becoming ready. Ordinary cleanup then failed browser-process termination
confirmation, producing `QA_CLEANUP_INCOMPLETE` and 6/7 released resources. Each
exact run was subsequently recovered with `npm run qa -- recovery recover
<run-id>`. Both recovery receipts are `RECOVERED`, with zero remaining processes
for their exact recorded identities. Original FAIL and cleanup reports remain
unchanged. Closing recovery inspection returned to the three pre-existing
abandoned journals; they were outside this task and were preserved. This pass
does not establish the cause of the repeated initial-frame delay.

Visual findings from the exact captures:

- **Narrow cap clipping:** `sites-intel-ledger-mixed-cap-editor.png` in the narrow
  run shows the anchored form opening below the trigger at the bottom of the
  403px scrollport. The input is partly clipped and Cancel/feedback/evidence are
  outside the visible sheet. Field/today/annotation relative geometry is unchanged
  before/open/close; surrounding layout stability alone misses this defect.
- **Canvas fit fails even on day one:** the narrow initial screen spends its
  visible height on Back, registry, domain/policy and today's number before any
  annotation or hourly field is visible. Desktop-low also stacks the registry
  above detail because the actual work area is about 697px wide, below the 759px
  spread breakpoint. All completed dates and opened slip/basis then add height.
- **Bonsai remains intact:** inspected first-day, recurring-focus and date-slip
  captures showed principal reading text/numbers outside the canopy. In portrait
  it occupies the lower sibling area; in desktop-low the safe ink width is about
  468px. The development-only QA example marker at the detail's upper right can
  overlap canopy paint and is not protected by the same safe-width treatment.
- **Coverage limits:** the fixture window is 20–22, so these runs do not certify
  a wrap-midnight header. Static inspection found that the long same-date window
  label can exceed the fixed nowrap value column. Global-cap utility canopy
  overlap and every open-state scrollbar-width transition are not established
  by these captures. No claim of universal zero occlusion or zero layout shift
  is made.

The single scroll owner is the existing `#sites-tab` in
`src/apps/dashboard/workspaces/sites/SitesManagementSurface.jsx`. P3 enlarged
the document inside it instead of maintaining a fixed height budget. Current
QA deliberately permits vertical scrolling to reach controls; its PASS does not
certify the user's no-scroll canvas. Correcting this needs a bounded basic view
and evidence/day/basis states that reuse its area, plus a cap editor placed fully
within the available sheet. No product UI was changed in this investigation.

The operator authorized exactly four additional superseded UI-record deletions;
the canonical prune removed only those four (44,406,579 bytes excluding removed
pin metadata). The final former no-scroll narrow baseline and all current P3/P4
evidence remain preserved. Details are in
`.artifacts/zen-site-ledger-detail/responsive-retention-review.md`. Both new FAIL
receipts are pinned for the measured defects and boot/cleanup investigation.
Closing retention was 2,143,809,934 bytes within the 2,147,483,648-byte budget;
three unrelated eligible runs were preserved under the exact four-run deletion
scope. No full suite, live dev server, personal browser or release build was used.

### P3 verification record (2026-10-11)

- Initial focused verification, before the generated-resource fix: `npm run test:file -- tests/zenSiteIntelResilience.test.jsx tests/zenSiteLedgerFormat.test.js tests/sitesTargetPanel.layout.test.jsx tests/sitesRegistryThemeContract.test.jsx tests/dashboardCaptureViewport.test.js tests/sitesSiteCap.test.jsx`: **148/148 passed** across six files.
- `npm run check:theme-typography:layering`, `npm run check:dashboard:i18n-contract`,
  `npm run check:ui:i18n-hardcoded-strings`, `npm run check:i18n:contract`,
  `npm run check:dashboard:owner-architecture`, `npm run check:qa:architecture`,
  and `git diff --check`: **passed**.
- `npm run qa -- run dashboard/capture --surface=sites --sites-scenario=intel-reading --theme=zen --presentation=hidden --viewport=desktop-wide`:
  **FAIL before browser launch**, not a presentation assertion failure. Run
  `20261011082937005-dashboard-capture-5d662e30` bundled its captured input and
  passed artifact checks, then Windows denied promotion and rollback with `EPERM`
  (`DEV_EXTENSION_ARTIFACT_TRANSACTION_RECOVERY_FAILED`). A second invocation,
  `20261011083720133-dashboard-capture-dcf918ed`, stopped at the canonical
  pre-build recovery with `DEV_EXTENSION_ARTIFACT_INTERRUPTED_PROMOTION_RECOVERY_FAILED`.
  Both runs released all resources and owned no remaining browser processes.
- At that failure, `dist` was absent and the exact old publication remained at
  `.artifacts/dev-extension-builds/previous`. The source change does not replace
  the publisher, copy that proof into another artifact path, or bypass its recovery.
  There are no P3 browser screenshots or visual PASS claims from those runs.
  The second run is pinned as recovery evidence. Retention inspection/prune found
  no eligible completed run directories; existing evidence remains preserved.
- Read-only lock investigation found an existing `zen/bonsai-first-bloom` operator
  preview (PID 11728, port 7110) holding many handles to the preserved publication's
  directories, and another preview on port 6144. Ordinary file-lock, ACL and
  Defender-event checks did not establish the exact rename-denial cause. These
  previews were not launched by P3's QA run and were initially left running pending
  operator authorization. Their existing Ctrl-C/server-close lifecycle was the
  preferred termination path, but this session could not access those server owners.
- The operator subsequently authorized stopping those two previews. After verifying
  their scene, port and PID identities, only PID 11728 / port 7110 and PID 14468 /
  port 6144 were stopped through the native process owner. Existing browser tabs
  were left intact. The third canonical attempt,
  `20261011084504119-dashboard-capture-a1bcf19d`, emitted
  `DEV_EXTENSION_PUBLICATION_INTERRUPTED_PROMOTION_RECOVERED`; `dist` exists again.
  The two FAIL outcomes above remain historical evidence, not the current
  publication state. That attempt built and published input digest
  `993a68d9aa5fb47f14e7431f30853ae835911d3d7a9121c16cb7f6bce216f0f3`
  successfully as build `20261011084550-42cb4a5944f0-dirty`.
- The third attempt then reached the browser and **FAILed** with
  `QA_ZEN_SITE_NOTEBOOK_NOT_ACCESSIBLE:ledger-partial`. Raw `usage_ledger` keys
  caused real horizontal overflow; this was not a false-positive layout guard.
  The authored locale JSON contained the new keys, but the generated runtime
  `sites.js` modules were stale. The artifact-only build had not run the normal
  prebuild locale synchronization. The canonical `npm run i18n:sync:modules`
  subsequently exited 0 and updated only the generated `en/sites.js` and
  `ko/sites.js` resources. The resilience test now imports those runtime `.js`
  modules instead of authored `.json`, so its source matches the runtime owner
  documented in `docs/architecture/repository/i18n-boundary-map.md`.
  After this correction, the same six-file focused command passed **148/148**
  again with the runtime resource imports. The additional
  `npm run test:file -- tests/siteIntelHourlyContext.test.js` passed **7/7**,
  giving **155/155** across the seven focused files. `npm run check:i18n:contract`
  and `npm run check:dashboard:i18n-contract` also passed again.
  A fresh desktop-wide run, `20261011085324911-dashboard-capture-32f37fc9`,
  built input digest
  `3301fefdc2e1bf9a35aff6c5907ba72cf66085336472ddbc0ebffc55f70f47d7`
  and passed the browser journey. The successful runs below establish the scoped
  presentation result; build/publication alone is not a UI QA PASS.
- A subsequent Zen-only `first-day` source fixture now exercises no completed
  observed dates with a populated observed today (14 minutes, eight completed
  sessions, six short sessions, maximum four minutes). It uses the existing
  `buildRuleSiteIntel` producer, yielding no historical patterns and ordered
  short-session, peak-window and visit-interval today notes. The canonical journey
  includes today's only row without an average, each available annotation and
  peak band, today's slip/Escape, basis, source continuity and navigation captures.
  The original 13-case non-Zen visit list is preserved. This new source is included
  in the 14-source Zen journeys and captured states of the successful runs below.

The canonical command above was repeated with `--viewport=portrait-narrow` and
`--viewport=desktop-low`. Each successful run visited all 14 Zen source fixtures.

| Viewport | Exact run | Build | Result |
| --- | --- | --- | --- |
| desktop-wide, 1784 × 849 | `20261011085324911-dashboard-capture-32f37fc9` | `20261011085357-42cb4a5944f0-dirty` | PASS, 14 sources |
| portrait-narrow, 560 × 960 | `20261011085555031-dashboard-capture-9565e5ac` | `20261011085613-42cb4a5944f0-dirty` | PASS, 14 sources |
| desktop-low, 1440 × 720 | `20261011085800814-dashboard-capture-8f394b16` | `20261011085820-42cb4a5944f0-dirty` | PASS, 14 sources |
| desktop-wide, final scrollbar material | `20261011090136268-dashboard-capture-b141a7b0` | `20261011090152-42cb4a5944f0-dirty` | PASS, 14 sources; pinned |

The final run built input digest
`950917e5744c7d4ab5072a2aa48091e43711982bf3a8cf497cf7df68d6a8311c`.
Its cleanup completed **7/7** with **0 active resources**, and app errors, warnings
and CSP violations were **0**. Narrow and low runs also completed cleanup 7/7
with no active resources; the narrow run reported no app errors, warnings or CSP
violations, and the low run reported no app errors.

Direct image inspection covered first-day, mixed, mixed-slip and cap editing,
including final first-day and mixed-slip captures. Runtime translations and the
horizontal overflow were fixed; numeric content remained outside bonsai occlusion.
Narrow presentation used a horizontal registry above the document and retained the
bonsai area below. The final white native scrollbar rail was removed with a thumb
mixed from the existing paper/text color tokens and a transparent track. A gradient
surface token had made an earlier `scrollbar-color` declaration invalid; the final
color-only correction changes neither scrollbar width nor the scroll owner or
geometry. **Only desktop-wide was rerun after that final color correction**; the
narrow and low PASS receipts cover the same layout before that correction.

An intervening QA attempt was **BLOCKED** by `QA_EVIDENCE_BUDGET_EXCEEDED`.
Canonical default retention pruning removed **54 eligible completed runs**, totaling
**27,557,952 bytes**, before the final successful run. That final receipt was pinned.
The closing retention inspect/prune reported **318 runs, 0 candidates, 286 protected
runs, 2,167,828,087 bytes** against a **2,147,483,648-byte** budget and removed no
additional runs (`BUDGET_EXCEEDED`). Further QA admission may remain blocked while
that protected evidence exceeds the budget; this does not invalidate the completed
PASS receipts. No protected evidence was deleted to make room.

### Bounded canvas implementation and verification (2026-10-11)

The follow-up preserves the existing Garden/bonsai geometry, paper tokens and
typography. The selected identity remains fixed; overview, daily history,
selected-day detail and reading criteria share one body. Actual item measurements
determine page breaks. Every date and fact remains reachable, including all 24
hourly quantities in the day detail. The overview stays mounted but hidden/inert
outside its view so a cap save can receive its ACK and settle normally. Back and
Escape unwind the current body before leaving the notebook; returning preserves
the selected annotation/date. The app-owned canvas removes retained loading
minimums, parks the narrow registry during selection and clamps the complete cap
form inside the usable sheet. No bonsai scale, stats criteria, query/storage
contract or settings key changes are part of this follow-up.

Focused validation:

- `npm run test:file:fast -- tests/zenSiteIntelResilience.test.jsx`: **27/27 PASS**.
- `npm run test:file:fast -- tests/sitesSiteCap.test.jsx`: **16/16 PASS**, including
  Apply → History → deferred ACK → idle settlement → notebook Back.
- `npm run test:file:fast -- tests/dashboardSitesRecordingJourney.test.js tests/sitesTargetPanel.layout.test.jsx tests/gardenModeTransition.test.jsx`:
  **PASS** (30 DOM tests and six recording protocol tests).
- `npm run check:theme-widget:no-fallbacks`, `npm run check:theme-typography:layering`,
  `npm run check:theme-shared-seams:architecture`,
  `npm run check:theme-seam-role-architecture`, `npm run check:qa:architecture`,
  `npm run check:i18n:contract`, `npm run check:docs:paths`, and `git diff --check`:
  **PASS**. The shared-seams guard's obsolete private Node QA import exception was
  retired with its owner documentation after the journey stopped using that import.

The canonical development build passed and published
`20261011102629-42cb4a5944f0-dirty`, input digest
`5e0377418c8df3bb89ccdd6d7067fc9a14684d48bf0e3ea72e1ed46491ab55a3`.
No full test suite, live dev server or production/release build was used.

The command
`npm run qa -- run dashboard/capture --surface=sites --sites-scenario=intel-reading --theme=zen --presentation=hidden --viewport=portrait-narrow`
passed in exact run `20261011103034424-dashboard-capture-86ff92c0` on that build.
It visited all **14 source fixtures** at **560 × 960**, with **301 access samples**:
zero control, scroll or visible-text failures. All 31 dates in complete windows,
every annotation/evidence page, day-detail page and criteria page were traversed.
Body geometry and surrounding layout remained stable during view changes and
cap editing. Cleanup released **7/7** owners. App errors, warnings and CSP
violations were **0**. The report summary cannot read the oversized full report
(`QA_REPORT_EVIDENCE_TOO_LARGE`); the retained exact journey attachment supplies
the per-page results. This run is pinned as the final narrow-screen evidence.

Intervening failures remain separate evidence. Run
`20261011101348975-dashboard-capture-440ce28f` used an intermediate artifact missing
the overview control and had incomplete cleanup; exact canonical recovery later
verified that its browser was already absent. Run
`20261011102532004-dashboard-capture-ea7f6e46` stopped at the cap form because the
text probe treated its intentionally clipped screen-reader label as painted text;
17/17 controls and all scroll bounds passed, and cleanup completed 7/7. The probe
now excludes only an actually clipped 1 × 1 `.sr-only` label, retaining all visible
text/control checks. Neither failed run is relabelled PASS.

The initial desktop-low attempt
`20261011103321025-dashboard-capture-1cd3132d` was **BLOCKED before browser launch**
by `QA_EVIDENCE_BUDGET_EXCEEDED`. Default canonical pruning removed six eligible
unpinned completed runs in two receipts (24,842,728 bytes total); protected pins,
research and incomplete runs were preserved. The user then explicitly approved
raising the canonical QA evidence budget from 2 GiB to **2.25 GiB**. Its owner,
CLI help, AGENTS and Active QA docs were updated together; the seven-day/three-run
policy, 24-hour grace and pin/cleanup protection remain unchanged. The focused
retention/admission tests passed **12/12**. No additional pinned evidence was
deleted. The decision is recorded in
`.artifacts/zen-site-ledger-detail/bounded-retention-review.md`.

The same intel-reading command with `--viewport=desktop-low` subsequently passed
in run `20261011104012534-dashboard-capture-dc4b0a60` on build
`20261011102629-42cb4a5944f0-dirty`. At **1440 × 720**, all **14 fixtures** and
**123 access samples** passed with zero control, scroll or visible-text failures.
The notebook canvas measured 697.22 × 612 px; its safe body measured
459.73 × 434.52 px. Cleanup released **7/7** owners; app errors, warnings and CSP
violations were **0**. This run is pinned. Direct inspection of narrow cap/day
and low overview/day captures confirmed complete controls and ink clear of the
unchanged bonsai. Oversized report summaries have the same coverage limit as
the narrow run; the exact journey attachment supplies all page results.

The final accessibility correction points each date button's `aria-controls`
at the stable body viewport, which exists before and after opening its day.
The focused 27-test ledger suite passed again, and the browser journey now
checks that every date resolves to that same live region. This correction changes
attributes only: the narrow/low layout receipts above precede it, with no CSS or
geometry changes afterward.

`npm run build` then published `20261011104219-42cb4a5944f0-dirty`, input digest
`6933a5a125e7bc1301d08db2dfa6436cd4dfbe89142a5030879fe5d9a90c7199`.
The intel-reading command with `--viewport=desktop-wide` passed in exact run
`20261011104747210-dashboard-capture-0291ef4a` on this final build. At
**1784 × 849**, all **14 fixtures** and **120 access samples** passed: zero
control, scroll, visible-text or controlled-region failures. All body/focus
continuity checks passed. Cleanup released **7/7** owners; app errors, warnings
and CSP violations were **0**. The run is pinned. Direct inspection covered
overview, day detail and the complete cap form. This is headless browser evidence,
not physical-GPU certification; the oversized-report summary limit is unchanged.

The preceding exact wide run `20261011104543525-dashboard-capture-6ae503c1`
remains **FAIL** (`QA_DASHBOARD_CAPTURE_BOOT_HEALTH_FAILED`). Its 14 fixtures and
120 layout samples passed, but the main composite first frame was ready about
9.58 seconds after boot, exceeding the existing 8-second boot budget. App errors,
warnings and runtime exceptions were zero and cleanup released 7/7 owners.
The same-build retry above passed without source, timing-limit or health-guard
changes. The failed receipt and observed startup delay are preserved; a host-load
cause is not established by these runs.

The final real-query refresh command
`npm run qa -- run dashboard/capture --surface=sites --sites-scenario=recording-refresh --theme=zen --presentation=hidden --viewport=desktop-wide`
passed in exact run `20261011104859307-dashboard-capture-85c3f160` on the same
final build. Its 65-second continuity observation and canonical reset-hour
invalidation completed without failures. The ready → loading → ready transition
preserved the selected date, criteria view, return-to-day view and page index;
scrollTop stayed zero and scrollHeight stayed 738 px. Recording-off,
protected-sites and excluded-protected-site cap admission checks also passed.
App errors, warnings and CSP violations were **0**, health was clean and cleanup
released **7/7** owners. The run is pinned. This uses real elapsed time and
canonical queries; it generates no foreground browsing and does not certify
usage writes during active browsing.

Closing retention inspection found three additional unpinned completed runs
newly eligible after the 24-hour grace. Canonical pruning removed **31,299,814
bytes** in receipt
`.artifacts/qa/retention/prune-2026-10-11T10-51-24-317Z-fa8855bd-4382-489a-ad4b-197e7d48aff7.json`.
The final inspect was **READY**: 309 runs, zero candidates, 285 protected runs,
**2,258,016,615 bytes** against the approved **2,415,919,104-byte** budget.
Protected research, pinned evidence and incomplete runs were preserved.
Final document-path, protocol-syntax and diff-whitespace checks passed.

## 11. Copy (Korean)

| Key purpose | Text |
| --- | --- |
| notes title (first / early / accumulated) | `오늘 나타난 것` / `지금까지 나타난 것` / `지난 30일에 나타난 것` |
| scope (accumulated) | `{start}–{end} · 기록 {o}일 · 이용 {a}일 · 오늘 제외` |
| short sessions | `짧은 이용이 여러 번 이어진 날` — `마친 이용이 6번 이상, 그중 2분 미만이 4번 이상이면서 55% 이상인 날` — caption `이용한 날 중` |
| long sessions | `20분 이상 이어진 이용이 있던 날` — `20분 이상 이어진 이용이 한 번이라도 끝난 날` |
| recurring time | `{s}–{e}시에 이용한 날` — `그 두 시간에 5분 이상, 그날 기록된 시간의 40% 이상이 있던 날` |
| change | `기록된 날의 하루 평균` `{ref} → {recent}분` — `{range} 기록 {n}일 · {range} 기록 {n}일. 기록 없는 날은 빼고 나눠요.` — caption `앞 15일 → 최근 15일` |
| today: short | `2분 미만에 끝난 이용` `{short} / {count}번` — `오늘 끝나서 확정된 이용만 세요. 지금 이어지는 이용은 아직 빠져요.` |
| today: window | `{s}–{e}시에 기록된 시간` `{w} / {total}분` — `오늘 00–24시 안에서 기록이 가장 많이 모인 연속 두 시간이에요.` |
| today: re-entry | `5분 이내 간격의 방문` `{n} / {visits}번` — `이전 방문 시작부터 다음 방문 시작까지 5분 이내인 경우예요. 배경 탭의 방문도 포함해요.` |
| today: friction | `멈춤 화면이 나타난 횟수` `{n}번` — `오늘 이어가기 {c}번 · 나가기 {l}번. 선택한 날에 따로 세어, 오늘 나타난 화면 수와 합이 같지 않을 수 있어요.` |
| early: pooled short | `2분 미만에 끝난 이용` `{short} / {count}번` — `기록된 {o}일의 마친 이용을 합친 수예요. 날짜별 수는 아래 줄에 있어요.` |
| early: longest | `가장 길었던 이용` `{m}분` (+ `20분 이상 이어진 이용은 아직 없었어요.` when none) |
| foot (first) | `여러 날에 걸친 반복은 기록이 7일, 이용한 날이 4일 쌓이면 보기 시작해요.` |
| foot (early) | `여러 날의 반복은 기록 7일 · 이용 4일부터 봐요. 지금은 기록 {o}일 · 이용 {a}일이에요.` |
| foot (accumulated) | `살펴보는 반복은 세 가지예요 — 짧은 이용이 여러 번 이어진 날, 20분 이상 이어진 이용이 있던 날, 같은 시간대. 기준에 닿은 것만, 해당하는 날이 많은 순서로 적어요.` |
| lead (none admitted) | `지난 30일 기록에서 기준에 닿은 반복은 없었어요.` |
| field title / sub | `오늘 한 줄` / `날마다 한 줄` — `위에서 아래로 {start} → 오늘 · 칸이 진할수록 그 시간에 기록된 사용이 길어요` |
| first-day sentence | `하루가 끝나면 이 줄은 장부에 남고, 다음 날 줄이 그 아래에 이어져요. 같은 시간대나 같은 모양이 여러 날에 겹치면 위에 주석을 달고, 해당하는 줄 옆에 같은 표시를 남겨요.` |
| row hint | `줄을 누르면 그날의 기록이 펼쳐져요. 주석을 누르면 해당하는 날과 시간이 이 면 위에 드러나요.` |
| slip: missing | `이 날은 기록이 남지 않았어요. 0분으로 세지 않고, 평균과 비율 계산에서 빼요.` |
| slip: today | `오늘 줄은 아직 쓰는 중이라 주석 판단에 넣지 않아요. 지금 이어지는 이용은 횟수에 아직 없어요.` |
| slip: zero | `기록은 남았고, 이 사이트 사용은 0분이었어요.` |
| slip: no match | `이 날은 위 주석 어디에도 해당하지 않았어요.` |
| basis | 1) `한 줄은 하루(00시–24시)예요. 칸의 진하기는 그 시간에 기록된 사용 시간이고, 30분 이상이면 가장 진해요.` 2) `‘기록 없음’ 줄은 0분이 아니에요. 평균과 비율에서 빼요. 기록은 있었지만 사용이 없던 날은 빈 칸만 있는 줄로 남겨요.` 3) `이용 횟수와 길이는 끝나서 확정된 이용만 세요. 이용은 끝난 시각의 칸에 속해요. 오늘 줄은 판단에 넣지 않아요.` 4) `주석은 지난 30일(오늘 제외) 중 기록 7일 · 이용 4일 이상일 때, 이용한 날의 절반 이상이면서 3일 이상에 같은 모양이 나타난 것만 달아요. 해당하는 날이 많은 순서로 적어요.` 5) `이 구분은 기록을 읽기 위한 기준이에요. 습관이나 의도를 판정하지 않아요.` |

The corrected today-note copy above follows the measured source semantics, rather than
the mock's exit-return wording or a response partition. C3 counts visit-start intervals
and independent response events; it cannot support either of those claims. This does
not change the visual target, historical admission criteria/order or the P3 UI in P2.

## 12. Reading-flow review and implementation (2026-10-11)

**아래 설계 검토를 승인받아 §12.6의 제품 패치로 진행했다.** 기존 디자인,
분재 크기·침범 범위, 재질·폰트, 고정 본문과 스크롤 없는 요구를 유지한다.
이번 순서는 네 장면의 평가 → 하루 상세 구성 확정 → 작은 구현 패치다.

### 12.1 현재 네 장면의 문제

평가 근거는 §10의 최종 wide 실행
`20261011104747210-dashboard-capture-0291ef4a`의 overview,
`mixed-focus-pattern-short_sessions`, `mixed-slip` 캡처와 현재 컴포넌트다.
아래 항목은 기존 QA PASS를 취소하는 것이 아니라, 그 검사가 보장하지 않았던
정보 위계·조작 의미와 추가 상태 보존의 개선점이다.

| 장면 | 현재 확인된 문제 | 제안 |
| --- | --- | --- |
| 주석 | 항상 보이는 모드 버튼과 내부 복귀 버튼이 같은 공간에 쌓임 | 주석면에는 날짜별 기록 진입을 남기고, 하위 면은 한 단계 복귀 하나로 정리 |
| 날짜별 근거 | 선택 주석 제목이 사라지고 기존 fieldAnchor를 재사용해 해당일이 없는 페이지로 진입 가능 | 주석 제목·값의 뜻을 이어주고, 최초 진입은 생산자가 준 최근 해당일이 있는 페이지 |
| 하루 상세 | 고정 분할로 기본 6장, 오늘 보통 7장, 과거 최대 10장. 제목 하나·0값 여섯 개만 있는 면도 전체 높이를 차지 | 기본면 하나와 직접 여는 세부 면으로 구성 |
| 복귀 | 로컬 Back과 X는 동일한 closeSlip. History는 focus를 지우고 Overview는 두 단계 이동하며 today 앵커를 초기화. 기준 면 왕복은 상세 내부 페이지를 잃음 | 동일 의미의 닫기 삭제, 맥락·날짜·페이지·선택 시간을 보존하는 한 단계 복귀 |

`ZenSiteDaySlip`은 현재 `focus`를 받지 않으므로 어떤 주석을 따라 들어왔는지
표현할 수 없다. 요약 1 + 길이 구간 1 + 시간별 4 + 선택 창 0~1 + 해당 주석별
1이라는 고정 분할이 여백과 조작 수를 만든다. 같은 내용을 큰 화면에서도 합치지
않는 것이 직접 원인이다. 0분 관측일에도 시간별 0값 네 페이지가 붙는다.

### 12.2 추천 구조: 하루 기본면 + 목적별 세부 열기

기본면에는 날짜·그날 기록량, 마친 이용 횟수, 최장을 함께 둔다. 주석을 따라
들어온 경우 그 주석에 대응하는 **관측 사실 하나**를 먼저 둔다. 직접 날짜를
열었으면 특정 패턴을 앞세우지 않는다. 다른 주석의 제목을 페이지로 반복하지 않는다.

기존 `mixed` source fixture의 9.4 완료일을 쓰면 다음과 같다.

```text
← 날짜별 기록                             읽는 기준
짧은 이용이 여러 번 이어진 날

9.4 금요일                                  60분

2분 미만에 끝난 이용
8 / 10번

마친 이용 10번 · 가장 긴 이용 45분

이용 내역 →                          시간별 기록 →
```

- `이용 내역`: 세 구간을 한 면에 제시한다. 이 fixture는 2분 미만 8번 /
  2–20분 1번 / 20분 이상 1번이다. 중간 구간은 기존 계약의 전체−짧은−긴 횟수다.
- `시간별 기록`: 기존 24칸 문법과 하나의 시간 선택 조작으로 정확한 수치를 읽는다.
  포인터·터치·키보드로 00~23시 모두 선택한다. 선택한 구간과 값은 항상 글자로
  보이고, 스크린리더에는 시간·단위·값을 함께 제공한다. 24칸 각각을 작은 터치
  버튼으로 만들지 않는다. 시간 선택의 Home/End와 화살표를 지원한다.
- 짧은 이용 맥락: `shortSessionCount / sessionCount`를 전면에 둔다.
- 긴 이용 맥락: `maxSessionMs`와 `longSessionCount`를 둔다. 누적 기록량을
  하나의 이용 길이처럼 표현하지 않는다.
- 반복 시간 맥락: 생산자의 창, `recurringWindow.activeMs`와 `share`를 둔다.
  이 fixture의 20–22시는 45분 / 하루 60분 · 75%다.
- 오늘의 peak/방문/멈춤 맥락: 해당 `todayNotes`의 value·denominator·responses만
  사용한다. 역사적 일별 DTO에 없는 재방문·멈춤 수치를 만들어 옮기지 않는다.
- 비교 맥락: 두 기간 평균과 표본 범위는 날짜 근거 면에 둔다. 개별 하루를
  증가·감소의 원인이나 대표일로 판정하지 않는다.

시간별 수치는 사용 사실의 시간대다. 그 시간에 세션이 시작했거나 끝났다는
타임라인으로 표현하지 않는다. 세션 분류 역시 세션별 실제 시작·종료 시각을
복원한 목록으로 그리지 않는다.

### 12.3 첫날·0분·비관측·짧은 기록

| 상태 | 기본면 | 세부 접근 |
| --- | --- | --- |
| 첫날/오늘 | 오늘·작성 중, 기록량, 마친 이용과 최장. 오늘 주석을 따라왔을 때만 해당 사실 강조 | 이용 내역·시간별. 여러 날의 습관 판정 없음 |
| 관측 0분 | 0분, 실제 계약의 마친 이용·최장. 수집된 0과 결측을 구분 | 0값이 있는 시간별 접근 가능. 활동 0을 이유로 완료 세션도 0이라고 추정하지 않음 |
| 비관측 | 기록 없음과 짧은 설명 | 숫자·시간별 버튼을 0으로 만들지 않음 |
| 1분 미만 | 근거에는 기존 초 단위 정밀도를 사용. 18초를 0분으로 표시하지 않음 | 같은 값과 정밀도 유지 |
| 자정을 넘는 반복 창 | 같은 날짜의 23–24시·00–1시처럼 두 구간을 명시 | 다음 날까지 이어진 방문·세션이라고 표현하지 않음 |

0분인 날의 창 비율 `share=null`은 0%가 아니다. 기존 `—`/분모 없음 문법을
유지한다. 비관측 여부·주석 해당일·창 선택·패턴 순서는 생산자가 결정한다.

### 12.4 이동과 상태의 의미

```text
주석 → 해당 날짜 근거 → 하루 기본면 → 이용 내역 또는 시간별
  ↑          ↑             ↑                  │
  └──────────┴─────────────┴──── 한 단계 복귀 ─┘
```

- 주석 진입: 최근 `matchedDates`를 페이지 앵커로 선택한다. 오늘 주석은 오늘,
  early의 이용 근거는 마친 이용 수치가 있는 최근 날짜, change는 최근 비교 기간의
  첫 관측일로 진입한다. 이는 읽기 시작 위치이며 대표일·원인 판정이 아니다.
  데이터 순서·판정은 바꾸지 않는다.
- 직접 날짜 진입: 현재 주석 focus를 명시적으로 해제한다. 주석이 없어도 모든
  표시된 날짜와 오늘에 접근할 수 있다. 선행 비관측 묶음의 개별 날짜 열기는
  이 최소 패치에서 새로 도입하지 않고, 현재의 묶음 의미를 유지한다.
- 로컬 복귀 하나를 두고 동일 기능의 X를 제거한다. 읽는 기준은 어디서든
  같은 영역을 쓰며, 닫으면 정확히 이전 면·페이지·선택 시간으로 돌아간다.
- 일별 세부 선택은 안정된 페이지/뷰 키로 domain·date 범위에 보존한다.
  크기 변화로 페이지 구성이 달라져도 같은 항목 앵커를 기준으로 다시 배치한다.
- 설계 검토 당시 앱의 상단 장부로는 내부 복귀와 별개의 목록 바로가기였다.
  단계별 Back 통합은 이름 변경에 앞서 앱 navigation owner의 pending/save 가드와
  입력 취소 체인을 먼저 공유해야 한다. 승인 후 구현은 §12.6처럼 이 조건을 충족했다.
- Esc·측면 Back·보이는 Back의 입력 편집 및 저장 중 동작을 같게 맞춘다.
  편집 취소 → 내부 면 복귀 → 목록 → 연못의 순서, 저장 중 이탈 방지를 유지한다.
- 숨겨진 Overview를 조건부 unmount하지 않는다. 한도 편집 draft·ACK·완료 타이머의
  기존 수명을 보존한다. presentation intent만 보존하고 사업 DTO를 캐시하지 않는다.

### 12.5 실제 패치 순서와 검증

1. `ZenSiteUsageReading` / `ZenSiteLedgerField`: 주석 제목 전달, 최근 해당일
   앵커, 주석 없는 직접 날짜 경로. 먼저 근거가 보이는 진입을 해결한다.
2. `ZenSiteDaySlip` / `zenSiteDaySlip.css`: 고정 순차 페이지를 기본·이용 내역·
   시간별 면으로 대체하고 표현용 focus를 전달한다. `zenSiteLedgerFormat`의
   정밀도 및 기존 계약을 그대로 사용한다.
3. `SitesManagementSurface` / `SitesWorkspace`와 기존 navigation owner:
   상단 목록 바로가기와 단계별 복귀의 역할을 정리하고, 입력·pending 가드 공유 후
   중복 버튼을 제거한다. 한도 편집 수명은 유지한다.
4. 해당 locale와 기존 durable flow 테스트·canonical Sites QA journey를 함께
   갱신한다. 패치 후 검증은 기준 왕복 시 선택 시간 유지, 모든 24시간 접근,
   관측 0분/비관측/오늘 구분, 주석→해당일 진입, 동일 Back 체인과 cap ACK에 집중한다.
   마지막에 세 named viewport에서 스크롤·잘림·캔버스 이동을 검증한다.

수치가 적은 면을 장식이나 추가 해석으로 채우지 않는다. 작은 높이에서 기본면의
실제 내용이 넘치는 경우에는 측정된 필수 블록을 묶어 나누며, 고정 7페이지로
되돌리거나 문구를 조용히 잘라내거나 글자·분재를 줄이지 않는다. 현재 노드 크기와
QA의 가장 작은 본문 예산(약 492 × 214px)을 구현 시 실측 기준으로 삼는다.

이 설계 검토에는 새 수집·저장 키·설정·계약 버전·통계 판정 변경이 없다.
제품 빌드나 새 브라우저 QA는 수행하지 않았다. 기존 PASS는 현재 구현의 검증이며
이 제안의 구현·시각 검증을 대신하지 않는다.
대화 시안의 DOM sanity 검사는 주석·날짜·이용 내역 전환, 모든 24시간 값과
접근성 이름, 기준 왕복의 시간 선택 유지, 31개 날짜 접근, 첫날/0분/비관측을
확인했다. 이는 브라우저의 레이아웃·시각 QA가 아니다. 문서 경로와 diff 공백
검사는 통과했다.

### 12.6 승인 후 제품 패치

`ZenSiteUsageReading`이 주석 진입 앵커와 날짜별 `{ subview, hour, anchor }`를
표현 상태로 보존한다. `ZenSiteLedgerField`와 `ZenSiteDaySlip`은 공통 제목
formatter를 읽어 선택 주석의 맥락을 이어준다. 직접 날짜별 기록 진입은 맥락을
해제한다. 하루는 기본면과 직접 여는 이용 내역·시간별 기록으로 바뀌었고,
24시간 native range의 시간·정확값을 시각 및 접근성 읽기값으로 함께 제공한다.
기본 필수 블록만 실측해 나누며, 한 면에 들어오면 페이지 조작을 숨긴다.

상단 Back·Esc·측면 Back은 앱의 동일 저장 가드/입력 취소/읽기 깊이/목록 경로를
사용한다. 내장 읽기의 중복 Back과 X·모드 점프를 제거했다. 기준 왕복은 선택한
시간과 세부 면을 보존한다. 크기 변화로 포커스된 페이지가 숨거나 pager가
사라지면 같은 읽기 영역으로 포커스를 돌리고, 만료된 날짜도 근거 면으로
명시적으로 돌아간다. 분재·프레임·읽기 폭·테마 재질은 유지했다.

계획보다 한 곳을 추가로 보완했다. 정책 snapshot이 loading/error일 때 기존
detail branch가 unmount되어 cap의 완료 타이머도 중단될 수 있었다. Zen cap의
React owner와 고정 portal host를 앱에 두고, 현재 admission을 전달하면서 기존
한도 slot과 조회 상태 band 사이에서 같은 host만 배치한다. 이는 사업 DTO 보관이나
조회 대체 경로가 아니다. draft·form/input identity·ACK·완료 타이머, 유효한 입력
포커스와 다른 컨트롤의 포커스 비탈취를 기존 focused 테스트로 확인했다.

새 수집·설정·저장 키·계약 버전 및 판정 기준·순서는 변경하지 않았다.
없어진 순차 상세·X·모드 점프의 미사용 locale 8개를 제거하고 실제 세부 진입과
선택 시간 읽기 문구를 추가했다. 생성 locale module도 동기화했다.

집중 검증:

- `npm run test:file:fast -- tests/zenSiteIntelResilience.test.jsx`: 29/29 PASS.
- `npm run test:file:fast -- tests/dashboardSitesIntelJourney.test.js tests/dashboardSitesRecordingJourney.test.js`:
  14/14 PASS. 실제 관측 여부에 맞춘 갱신 검증을 포함한다.
- `npm run test:file -- tests/sitesHudLoadingContract.test.jsx tests/sitesSiteCap.test.jsx tests/dashboardNavigationButtonLock.test.jsx`:
  75/75 PASS. 실제 키보드로 상단 Back을 실행한 뒤 편집을 취소하고 한도 값으로
  포커스를 돌리는 회귀 사례를 포함한다.
- 변경 theme/app 소스의 `node scripts/lint.mjs <affected files>` PASS.
- `git diff --check`, theme widget no-fallbacks, typography layering, shared seams,
  seam-role architecture, dashboard owner architecture, QA architecture, i18n contract,
  docs paths 검사 PASS. 전체 테스트와 dev server는 실행하지 않았다.

최종 빌드와 세 named viewport 및 실제 조회 갱신의 브라우저 검증 기록은 아래에
실행별로 추가한다. 이전 §10 PASS를 이번 패치의 결과로 재사용하지 않는다.

최종 개발 빌드 `npm run build` PASS:

- buildId: `20261011123406-42cb4a5944f0-dirty`
- inputDigest: `a097fdff105fa5af33a232288a743f458f72137bef6d77a63e320eafa06d7391`
- 정식 snapshot/publisher 및 개발 artifact 검사 PASS.
- 로그: `.artifacts/zen-site-ledger-detail/reading-flow-build-final.log`.

같은 빌드의 `dashboard/capture --surface=sites --sites-scenario=intel-reading
--theme=zen --presentation=hidden --viewport=<name>` 결과:

| Viewport | Exact run ID | 원본 검사 결과 |
| --- | --- | --- |
| portrait-narrow · 560×960 | `20261011123555500-dashboard-capture-d249b147` | PASS · 14 사례, 768 시간 선택값, 접근 검사 1,214건 |
| desktop-low · 1440×720 | `20261011123928904-dashboard-capture-5c9c0861` | PASS · 14 사례, 768 시간 선택값, 접근 검사 1,004건 |
| desktop-wide · 1784×849 | `20261011124139852-dashboard-capture-3804bae9` | PASS · 14 사례, 768 시간 선택값, 접근 검사 1,001건 |

세 실행 모두 control/text/scroll 실패 0, 목록 왕복의 panel/body identity와 포커스
복귀 PASS. 좁은 화면의 반복 시간 근거·기본면·시간별 면, 낮은 화면의 시간별 면,
일반 화면의 주석 면을 직접 이미지로 확인했다. 글자가 분재에 가려지거나 본문이
프레임 밖으로 잘리는 현상은 없었고, 기존 분재 크기와 침범을 유지했다.
실제 사용자 터치 입력과 읽는 도중 resize 전후의 상태 보존을 이 고정 viewport
실행으로 인증하지는 않는다. 자정 넘는 창의 산출은 기존 생산자/계약 검증 범위다.

각 exact ID에 `npm run qa -- report <id>`도 실행했다. 요약기는 큰 capture JSON에
`QA_REPORT_EVIDENCE_TOO_LARGE`를 표시하므로, 각 실행의 원본
`attachments/dashboard-sites-intel-journey.json`을 별도로 읽어 위 수치를 확인했다.
run verdict는 PASS이며 app error/warning/CSP는 0. browser stderr는 각각 3/6/6건으로
별도 보존한다. 모든 실행 cleanup은 complete · 7/7 released이고, 요약의 active
processes는 unknown이다. 이를 프로세스 수 0으로 바꾸어 보고하지 않는다.

앞선 좁은 실행 `20261011122621561-dashboard-capture-eb995ae6`은
`QA_ZEN_SITE_LEDGER_CAP_BACK_CANCEL_FAILED:visible-back`으로 FAIL했다. 취소는
정상이었으나 상단 Back의 키보드 포커스가 한도 값으로 돌아가지 않았다.
명시적 Back 호출 당시의 focus owner에 한해 복귀를 허용하고, 숨은 overview 및
늦은 ACK의 다른 컨트롤 포커스는 유지했다. 위 최종 세 실행에서 같은 검사를
통과했다. 실패 기록과 cleanup complete · 7/7도 보존한다.

실제 갱신 검증은 `npm run qa -- run dashboard/capture --surface=sites
--sites-scenario=recording-refresh --theme=zen --presentation=hidden
--viewport=desktop-wide`로 실행했다. 최종 exact run
`20261011124841613-dashboard-capture-3feace9b` PASS, 같은 개발 빌드다.
`qa report`도 PASS이며 app error/warning/CSP 0, browser stderr 4,
cleanup complete · 7/7 released, active processes unknown이다.
65,009ms 관찰 동안 자동 갱신 computedAt이 증가했고 실패 0이었다.
이후 실제 설정 무효화의 ready→loading→ready를 관측하면서 이전 사업 reading의
철회, 새 computedAt, 스크롤 0, 본문 폭과 읽기 intent 보존을 확인했다.
기준에서 날짜 기본면으로 복귀한 뒤에도 숫자·세부 조작이 생기지 않았다.

이 실행의 실제 source는 비관측 오늘이었다. receipt의 selection은
`{ kind: 'unobserved-summary', observed: false, dateStr: '2026-10-11' }`이다.
따라서 이 실행은 기록 없는 기본면의 갱신 보존을 증명하며, 관측 시간 17의 실제
갱신 보존을 증명하지 않는다. 관측일이면 기존 hours=17 검증을 그대로 수행한다.
시간 선택 보존은 이번 집중 읽기 테스트와 세 viewport의 기준 왕복에서 검증했다.
최초 갱신 실행 `20261011124344357-dashboard-capture-e51f77a0`은 비관측 오늘에도
hours를 요구한 QA 전제 때문에 FAIL했다. 실제 canonical detail의 관측 여부를
엄격히 읽어 비관측에는 기본면·숫자·세부 조작 부재를 적극 검증하도록
protocol/tests/Active QA 계약을 함께 수정했다. 제품·fixture·수집은 바꾸지 않았다.

종료 retention inspect/prune READY: 최신 최종 네 실행은 이유와 함께 pin했고,
당일 보호 기록을 지우지 않았다. 종료 시 eligible 0, 삭제 0,
2,400,667,968 / 2,415,919,104 bytes. 이 작업 시작 시 canonical prune으로
기존 eligible 완료 실행 5건·12,043,185 bytes를 정리했으며, 연구·기존 pin·진행 중
실행은 보존했다. 최종 prune receipt는
`.artifacts/qa/retention/prune-2026-10-11T12-51-34-152Z-ea63f444-e5e8-4f46-99ff-fb8863f1b050.json`이다.

### 12.7 관측 기록 화면의 실제 조회 갱신 QA (2026-10-12 KST)

`dashboard/capture`에 `observed-reading-refresh`를 추가했다. 기존 `mixed` source
fixture를 실제 `buildRuleSiteIntel` 생산자와 엄격한 통계 계약에 통과시켜 표시하고,
실제 설정 ACK에 따른 query invalidation·이전 reading 철회·새 snapshot admission을
실행한다. 제품 UI·fixture·수집·저장·판정 기준은 변경하지 않았다.

선택은 예시 관측일 `2026-09-07`의 12시, 정확히 `3,600,000ms`(60분)다.
비관측 경로로 이 검사를 대신 통과할 수 없다. 시간별 면에서 기준으로 이동한 뒤
실제 갱신을 수행하고, Back으로 돌아와 선택 날짜·시간·정확값·native range 포커스를
확인한다. 갱신 중 view·returnView·basisPageIndex·주석 문맥과 day/field/annotation
anchor가 동일하며 본문 위치·크기·스크롤도 유지돼야 한다.

실행 명령은 `npm run qa -- run dashboard/capture --surface=sites
--sites-scenario=observed-reading-refresh --theme=zen --presentation=hidden
--viewport=<name>`이다. 기존과 정확히 일치하는 개발 빌드
`20261011123406-42cb4a5944f0-dirty` 및 inputDigest
`a097fdff105fa5af33a232288a743f458f72137bef6d77a63e320eafa06d7391`를 재사용했다.

| Viewport | Exact run ID | 결과 |
| --- | --- | --- |
| desktop-wide · 1784×849 | `20261011145825013-dashboard-capture-3cd1143e` | PASS · ready→loading→ready, reading intent 완전 동일, 실패 0 |
| portrait-narrow · 560×960 | `20261011145929150-dashboard-capture-33e0a6d1` | PASS · ready→loading→ready, 분할된 근거의 anchor 유지, 실패 0 |

두 실행 모두 24시간 원본값과 12–13시·60분 읽기값, 날짜와 문맥, 복귀 포커스가
전후 동일했다. before/basis/after 접근 검사 모두 PASS, scrollTop 0, 본문 rect
변화 0이다. 좁은 화면 본문은 `492×214.109375px` 안에 수납됐다. 갱신 전후 결정
PNG도 직접 확인했다. 새 snapshot computedAt은 일반 화면에서
`1791730727174→1791730749343`, 좁은 화면에서
`1791730791256→1791730813265`로 증가했다.

각 exact ID의 `npm run qa -- report <id>` PASS. app error/warning/CSP 0,
browser stderr 각각 4건, cleanup complete · 7/7 released, active processes
unknown이다. 최초 일반 화면 실행 `20261011145625557-dashboard-capture-fc4e29de`는
읽기 보존 검사를 통과했으나 `mainTabFirstFrameWaitBudgetExceeded`로 전체 FAIL했다.
대기 기준이나 제품을 바꾸지 않고 같은 조건을 순차 재실행해 위 PASS를 얻었다.
실패 실행과 원본 진단도 보존한다.

범위는 명시적 관측 예시를 표시한 UI의 실제 query admission/remount 보존이다.
격리 프로필의 실제 canonical day는 비관측이며 receipt에 별도로 남겼다.
따라서 저장된 사용자 기록의 수집 정확성, 값 자체가 달라지는 갱신, 시간별 면이
직접 보이는 순간의 자동 갱신을 이 실행으로 인증하지 않는다. 기준을 읽는 동안
선택 시간이 보존되고 원래 시간별 면으로 정확히 복귀하는 것을 검증했다.

집중 검증:

- `npm run test:file:fast -- tests/dashboardSitesRecordingJourney.test.js tests/dashboardSitesIntelJourney.test.js`: 16/16 PASS.
- `npm run test:file:fast -- tests/dashboardCaptureViewport.test.js`: 31/31 PASS.
- 변경 두 protocol의 `node --check`, `git diff --check`,
  `npm run check:qa:architecture`, `npm run check:docs:paths` PASS.
- 전체 테스트·dev server·불필요한 새 빌드는 실행하지 않았다.

최종 PASS 두 실행은 목적과 범위를 명시해 pin했다. 종료 retention inspect/prune
READY · eligible 0 · 삭제 0 · `2,412,323,716 / 2,415,919,104 bytes`.
연구·기존 pin·실패 진단을 삭제하거나 보관 예산을 늘리지 않았다. receipt:
`.artifacts/qa/retention/prune-2026-10-11T15-00-52-938Z-7f8e9c63-6855-4c43-9178-4489daa94e38.json`.

### 12.8 실제 수집·저장 기록의 갱신 검증 (2026-10-12 KST)

전용 `dashboard/sites-stored-reading-refresh` target을 추가했다. 격리된 개발
브라우저의 `ledger.localhost`에서 실제 foreground 시간을 수집하고 정상 segment
sealer·typed stats 저장을 거친다. 통계 fixture, 직접 DB 입력, 시계·시간 주입은
없다. 워커 종료·재생성 뒤 canonical snapshot/detail query의 시간별 값·완료
세션·collection observation이 동일해야 한다. 추가 실제 사용으로 값과 완료 세션이
증가한 상태에서 hours와 basis 각각의 query withdrawal/readmission을 검사한다.
개인 authenticated 프로필의 기존 기록을 읽거나 변경하는 검사는 아니다.

실제 수집을 위해 headed foreground를 사용한다. 최초 native focus owner가
`QA_WINDOWS_CHROME_FOREGROUND_FAILED:focus_window`로 거부된 두 실행
`20261011153852327-dashboard-sites-stored-reading-refresh-abc78a46`,
`20261011154040180-dashboard-sites-stored-reading-refresh-6c9e03f5`는 FAIL이며
cleanup 7/7 complete다. 이후 명시적 focus opt-out을 사용했다. 이 경로는 native
foreground가 실제로 확인되는 경우에만 진행하고 OS refocus를 하지 않는다.

실제 기록 실행 `20261011154319843-dashboard-sites-stored-reading-refresh-032e01b5`에서
첫 사용 8,469ms·완료 세션 1개가 워커 재생성 후 그대로 조회됐고, 추가 사용 후
16,638ms·2개로 증가했다. 날짜·선택 시간·읽기 intent·전체 24시간 값은 유지됐으나
hours remount 후 range 포커스가 없어 전체 FAIL했다. cleanup 8/8 complete다.
후속 진단 `20261011154615434-dashboard-sites-stored-reading-refresh-c3af1b49`는
native 탭 왕복 후와 invalidation 직전까지 range focused=true, 새 admission
후에만 DaySlip SECTION으로 이동함을 확인했다. 원인은 DaySlip의 무조건 mount
autofocus였다. 이 실행의 불완전 cleanup은 정확한 run의 canonical recovery로
해결했고 원본 FAIL·cleanup 기록과 별도 recovery receipt를 보존·pin했다.

수정은 Zen presentation focus owner 안에 한정했다. DaySlip mount autofocus를
제거하고 명시 탐색의 포커스는 ZenLedgerContents가 맡는다. 철회 직전 실제로
포커스된 native range의 domain/date/hour만 일회성 intent로 남기며, 같은 관측
hours가 돌아오고 현재 focus가 비어 있을 때만 복원한다. 외부 control 포커스,
도메인·날짜·시간 변경, 관측 소멸·미로딩은 복원하지 않는다. canonical 통계나
수집·저장·판정은 바꾸지 않았다.

검사도 기본값 회귀를 잡도록 강화했다. 실제 증가 bucket(growthHour)과 사용자의
비기본 선택(selectedHour)을 분리한다. 실제 기록이 0시에만 있으면 관측일의 실제
0값인 1시를 선택하고, 0시의 증가 및 전체 24시간 값은 별도로 대조한다. basis가
여러 페이지이면 다음 페이지를 읽은 뒤 갱신하고 index·문구·anchor를 비교한다.
viewport는 요청 이름뿐 아니라 실제 innerWidth/innerHeight/DPR도 대조한다.

- 제품 집중 테스트 `npm run test:file:fast -- tests/zenSiteIntelResilience.test.jsx`: 38/38 PASS.
- QA 집중 테스트 `npm run test:file:fast -- tests/dashboardSitesStoredReadingJourney.test.js tests/dashboardSitesRecordingJourney.test.js`: 31/31 PASS.
- 제품 두 파일 ESLint, 두 새 QA module의 `node --check`, 대상 `git diff --check` PASS.
- `npm run build`: PASS, 개발 빌드 `20261011155459-42cb4a5944f0-dirty`, inputDigest `c14743060d6b60897f95b6d7f7858de72b1c0766cecf72ef3e2f0503314ac1e4`.

**최종 검증 상태: PASS.** 사용자가 2.3GiB 보관 한도를 승인한 뒤 canonical
retention policy·기대 계약·Active QA 문서를 함께 갱신했다. 바이트 한도는
`Math.floor(2.3 * 1024 ** 3) = 2,469,606,195`이며 age/count/grace·pin 보호는 같다.

최종 명령은 `npm run qa -- run dashboard/sites-stored-reading-refresh
--viewport=<name> --allow-initial-window-focus-once=false`다. 두 실행 모두 위 개발
빌드를 정확히 재사용했다. 실제 viewport/DPR을 전후 대조했고, 값은 fixture가 아닌
해당 실행의 실제 foreground 사용이다.

| Viewport | Exact run ID | 실제 사용 증가 | 읽던 근거 | 결과 |
| --- | --- | --- | --- | --- |
| desktop-wide · 1784×849 · DPR 1 | `20261011164248881-dashboard-sites-stored-reading-refresh-d5b0fbb6` | 9,471→17,631ms · 완료 세션 1→2 | 전체 1페이지의 1페이지 유지 | PASS |
| portrait-narrow · 560×960 · DPR 1 | `20261011164427482-dashboard-sites-stored-reading-refresh-38f2adb3` | 8,930→17,072ms · 완료 세션 1→2 | 2페이지 중 2페이지 및 문구 유지 | PASS |

두 실행의 선택은 실제 관측일 `2026-10-12`의 1시다. native range의 기본값 0에서
키보드로 바꿨고 해당 시간의 실제 수집 값이 증가했다. 워커 재생성 뒤 첫 기록의
24시간 값·완료 세션·collection observation이 정확히 보존됐다. hours와 basis
각각 ready→loading→ready 및 더 최신 computedAt을 관측했으며 reading intent의
날짜·시간·day/field/annotation anchor·returnView·basisPageIndex를 유지했다.
hours 직접 갱신 후와 basis의 Back 후 모두 선택 1시와 range 포커스가 유지됐다.
직접 갱신 전후 document.hasFocus()와 range activeElement도 모두 true다.

시간별 본문은 일반 화면 `484.3125×558.515625px`, 좁은 화면
`492×214.109375px`로 전후 rect 변화 0이었다. before/hours-after/basis/after
접근 검사 모두 PASS, 실패 control/text/scroll 및 nestedScrollCount 모두 0,
scrollTop 0이다. 결정 before/after PNG 네 장도 직접 확인했다. 각 exact run의
`qa report` PASS, dashboard health clean·issue 0, cleanup complete·8/8 released다.
요약의 active-process 수치는 unknown이므로 별도 전체 프로세스 소멸 인증으로
확대하지 않는다.

첫 수정 후 실행 `20261011164021818-dashboard-sites-stored-reading-refresh-35378be7`는
journey를 완료했지만 QA 코드가 존재하지 않는 `diagnostics.getSnapshot()`을 호출해
전체 FAIL했다. 실제 진단 소유자의 `snapshot()`으로 수정하고 journey receipt도
health 검사 직전에 보존하도록 했다. 제품·판정·검증 기준은 바꾸지 않았다.
이 원본 실패는 보존하며 cleanup 8/8 complete다. 보관 한도 집중 테스트의 옛
2.25GiB 기대값도 승인한 정수 바이트 값으로 갱신했다.

추가 검증:

- `npm run test:file:fast -- tests/entropyQaEvidenceRetention.test.js tests/qaRetentionAdmission.test.js`: 12/12 PASS. 제품/QA 집중 검증을 합쳐 이번 작업의 최종 집중 테스트는 81개 PASS다.
- `npm run check:qa:architecture`, `npm run check:docs:paths`, 수정 QA module·retention의 `node --check`, 대상 `git diff --check` PASS.
- 전체 스위트·dev server·불필요한 재빌드는 실행하지 않았다. 실제 수집용 finite loopback server와 격리 browser는 각 run lifecycle로 정리했다.

최종 두 PASS는 범위를 명시해 pin했다. 종료 retention inspect/prune READY,
eligible 0·삭제 0·`2,428,765,201 / 2,469,606,195 bytes`다. 기존 증거는 보존했다.
receipt는 `.artifacts/qa/retention/prune-2026-10-11T16-47-06-643Z-3f475397-45ee-4dbb-8b0e-887315e79c5c.json`이다.


## 13. Accepted single-sheet composition (2026-10-12)

User-approved implementation: root site selection → one domain sheet; no permanent
site index. Domain identity precedes calendar dates and the selected day's factual
reading. At compact heights the selected day is primary and its date button swaps
the same area for dates. Hours/session length are siblings; overview/evidence/day
summary drill-down is retired. Admitted cumulative facts remain in producer order,
with no representative type or compulsory three slots. Focus highlights matching
dates without changing their total usage or selected date. Missing runs group only
in the overview; individual dates remain accessible in date selection. The one-day
average duplicate and per-date hourly micrographs are removed.

The full-size bonsai and physical frame are unchanged. `homeCanopyReading` now
publishes `zen-home-canopy-reading-envelope-v2`: layoutSignature, 64 normalized Y
bands (null explicitly means no tree paint in that band), and aggregate minimumXRatio
for consumers requiring a conservative whole-region inset. Bands include all history
wood-segment endpoints/girth, blossoms/pedicels and living tips, canonical paint
reserve and analytic maximum root sway. Camera scale/orientation remain canonical.
`woodSegments` is transient camera anatomy, not a persisted storage contract.

`api/homeReadingSpace.js` is the narrow React seam for `ZenHomeReadingSpace` and
`ZenReadingBlock`. Garden supplies committed CSS geometry; reading blocks query the
bands intersecting their own height with 16px clearance. No frame-time alpha read,
weather/growth-driven typography motion, second camera or business DTO cache.
The same physical foreground seam supplies an additional height-local footing
exclusion; lower numbers and controls cannot sit behind the stone lip. This does
not narrow clear upper heights or change the physical frame.
Pending/mismatched receipts retain existing explicit readiness; malformed receipts
throw. Component left baselines stay aligned while available widths vary by height.

Existing protection/recording/cap command owners move into the management disclosure.
Initial date is observed today, latest observed historical day (including zero), or
missing today. Explicit date/hour/page/focus survives snapshot readmission. Out-of-window
selection requires explicit date selection. Geometry, not font shrinking or clipping,
selects simultaneous versus compact reading; single-page navigation stays absent.

Validation for this revision must be recorded separately from §12: focused producer/
geometry/flow tests, canonical development publication and fresh named viewport QA.

### 13.1 Implementation and verification receipt

Implemented the v2 geometry seam and single-sheet flow without changing collection,
stored settings/keys, pattern admission/order, bonsai camera or physical frame.
Date selection and criteria return now restore keyboard focus to their own control;
hours/session length remain sibling choices outside the workspace Back stack.
Snapshot withdrawal keeps only ephemeral reading/focus intent, never a retained
business DTO. Explicit selections outside the new query window are diagnosed and
require the user to choose another date.

Focused tests: 185 PASS across eight relevant geometry, formatting, reading flow,
cap integration and QA contract files. This includes independent full-history,
maximum-sway flower corner checks at DPR 1/1.25/2, observed zero/missing dates,
source-order focus, explicit date/hour/page readmission, keyboard return and resize
between simultaneous and compact layouts. No full suite or dev server was run.
Renderer lifecycle/alpha/client tests add 33 PASS, and retention admission/policy
tests add 12 PASS. The physical footing projection is included in the geometry
tests; day/hour and cap flow tests were repeated after bounding the page controls.
Public theme entries, typography layering, docs paths, i18n contracts/families,
QA architecture, focused ESLint and owned-file whitespace checks passed.

Canonical `npm run build` PASS, latest tested publication:
`20261012051956-4d5131aea1de-dirty`, inputDigest
`74b54d1fd985583d44df27c766358a446647b18175a381b814d22d2f68a32d6d`.
The canonical QA owner rebuilt on changed checkout inputs and published `dist/`;
each run retained its exact build rather than reading a later mutable publication.

Fresh `dashboard/capture --surface=sites --sites-scenario=intel-reading --theme=zen
--presentation=hidden` checks all 14 source cases, every date, 24 actual hourly
values for observed days, session bins, complete criteria pages, management/cap
cancellation, Esc and native mouse Back. The existing access inspector finds no
clipped controls/text, nested scrolling or out-of-frame content.

| Viewport | Exact run ID | Result |
| --- | --- | --- |
| 1784×849 · DPR 1 | `20261012051208177-dashboard-capture-75164958` | PASS |
| 1440×720 · DPR 1 | `20261012051445412-dashboard-capture-5813e3b0` | PASS |
| 560×960 · DPR 1 | `20261012051854476-dashboard-capture-7d662458` | PASS |
| 1784×849 · DPR 2 → low → narrow → initial, followed by query refresh | `20261012052257849-dashboard-capture-5459cb76` | PASS |

Decisive first-day, mixed, narrow and restored-hour captures were inspected directly.
Each run released 7/7 lifecycle resources with complete cleanup. The three final
fixture runs report zero active owned processes; the final refresh process-count
summary is unknown. Neither is a separate whole-machine process certification.
Source-fixture PASS does not certify collection or personal-profile history.

Final refresh checks preserve date, hour, body choice, criteria page, reading
anchors and range focus across actual layout/DPR changes and acknowledged query
withdrawal/readmission. These PASS runs are pinned with their exact scope.

Fresh QA found and corrected two defects beyond the initial composition changes:

- `20261012045359984-dashboard-capture-7601331d` failed after a real resize because
  RESIZE changed the worker surface before its projected SCENE arrived. Rendering
  now waits for the matching scene/surface; rapid return to the committed surface
  can reuse that exact scene. The strict rain/soil geometry checks remain intact.
  The owning worker spec §6.2 and lifecycle tests document this ordered pending
  state. No extra worker, scene fallback or altered camera was introduced.
- Direct capture review found a lower hour value hidden behind the stone lip.
  Composition now adds the canonical foreground profile's height-local exclusion,
  and all page controls consume it. The independent QA foreground-occlusion check
  then caught the old Next button in `20261012051031990-dashboard-capture-1abe5bce`.
  The final four PASS runs include both corrections, rather than reusing old QA.

The earlier evidence-budget BLOCKED run
`20261012044919015-dashboard-capture-36874a72` remains preserved. The user approved
a shared 10 GB (10,000,000,000 bytes) default on 2026-10-12; the retention owner,
CLI help, tests, AGENTS and Active QA docs now agree. Age/count/grace and pinned/
incomplete safety rules are unchanged. No per-run budget bypass was added.

Additional fixture-free stored-record QA was attempted with the new screen, but
does not have a PASS for this revision. Exact runs
`20261012050538717-dashboard-sites-stored-reading-refresh-77ffc0e2` and
`20261012052649649-dashboard-sites-stored-reading-refresh-91b79300` failed native
foreground admission immediately after the single initial-window preparation;
the first source window was unfocused, and the second was minimized/hidden.
The protocol correctly rejected both before certifying a collection interval.
Both released 7/7 resources with complete cleanup (the latter reports zero owned
processes). Runtime-resource BLOCKED attempts also remain preserved. No repeated
focus repair, substitute profile, injected records or relaxed assertion was used.
This declared headed exception was needed for actual foreground collection,
whereas all four final presentation/resize runs above were hidden/headless.
Neither these attempts nor earlier-design PASS runs certify this revision with
the regular Chrome 지훈 profile or its accumulated personal history.

Final commands include the eight focused design/flow files, the worker lifecycle/
alpha/client trio and retention/admission pair through `npm run test:file:fast`;
`npm run check:qa:architecture`, `npm run check:docs:paths`, focused ESLint and
owned-file `git diff --check` passed. The named QA commands are `dashboard/capture`
with `--surface=sites --theme=zen --presentation=hidden`, `intel-reading` at
desktop-wide/desktop-low/portrait-narrow, and `observed-reading-refresh` at
desktop-retina. No full suite or live dev server was started.

Task-close retention inspection was READY at 2,536,412,238 / 10,000,000,000 bytes.
Canonical prune removed only three eligible completed, unpinned older runs
(3,039,508 bytes); current/incomplete/pinned evidence was protected. Receipt:
`.artifacts/qa/retention/prune-2026-10-12T05-31-37-379Z-1676a34e-8d92-4749-9a6d-95ed4fdca050.json`.
