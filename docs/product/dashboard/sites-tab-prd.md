# Sites Tab PRD

- Status: Active
- Owner: dashboard product
- Last validated against code: 2026-10-11
- Path policy: current-only
- Canonical for: Sites tab information architecture, decision semantics, and safety contract
- Depends on:
  - `docs/architecture/repository/sites-schedule-boundary-map.md`
  - `docs/architecture/repository/storage-stats-tracking-boundary-map.md`
  - `docs/domains/stats/stats-engine-baseline.md`
- Non-goal:
  - protection engine or schedule evaluator redesign
  - special isolation mode implementation
  - cross-device or server analytics

## 1. One-line definition

Canonical tab ID: `sites`. Zen navigation/title: `길목` / `Pathways`.
The garden-path metaphor represents frequently visited places whose use and
protection can be adjusted; it does not imply a permanently closed threshold.

`Sites is the local decision workspace where observed behavior becomes an explicit site policy.`

It is not a domain inventory, a raw statistics dashboard, or a second Protection
tab. It must help the user answer three questions in order:

1. What is happening on this site?
2. What does that evidence mean for my intention?
3. What policy change should I make now?

## 2. Product role

Entropy slows automatic reward seeking so the user can recover a deliberate
choice. Sites owns the domain-level version of that loop.

- `Overview` explains whether the system is helping overall.
- `Sites` decides which domains to protect and which recorded behavior warrants attention. Recording admission is an independent privacy choice.
- `Protection` explains how an active protection posture behaves.
- `Schedule` decides when policy applies.

The surface helps users understand an observed use pattern without requiring a
settings change. Measurements are useful when their scope and meaning are clear.

## 3. Canonical information architecture

```text
Sites (one open outer boundary)
├─ Page toolbar: protected-sites combined policy -> in-place numeric editor; notebook Back
├─ Ledger (default)
│  └─ Full-width registry: optional policy filters, direct sort, search / inline composer
└─ Observation notebook (explicit site selection or route)
   ├─ Selected site identity and separate protection / recording controls
   ├─ Current usage and saved site cap -> in-place numeric editor
   ├─ Producer-ordered annotations and one growing calendar-day ledger (Zen)
   ├─ Annotation focus on the same field; selected-date slip below it (Zen)
   └─ Visible period and coverage, with an inline collection-basis disclosure
```

Zen presents the registry and selected notebook as a spread, stacking at narrow
widths. Other themes use the full work surface in turn. Opening
Sites without a site route shows the ledger; the first ranked row is not
automatically opened. A row selection or explicit external route opens the
notebook. An external route may select a domain outside current list membership;
its canonical policy-only detail remains available without adding a historical row.

Back returns to the ledger and restores its scroll position and selected row's
focus. If that row is absent from the current filtered list, focus returns to
search. It retains the selected domain and mounted detail subtree, so this change
does not discard the admitted reading or become a query/cache boundary. The registry
also remains mounted while hidden, preserving search, sort and bounded list state.
The page-level combined cap and workspace notices remain available in either view.

`SitesTab` owns both the active registry scope and the selected domain. Theme
registry widgets are controlled projections of that state; they must not keep a
second scope owner. Selecting an empty scope keeps that scope visible and clears
the detail selection. It must never fall through to the first item in another scope.

## 4. Registry contract

### 4.1 Rows are for recognition and selection

Broad ledger rows group favicon/domain recognition, a plain policy status,
recorded daily average and a restrained usage comparison mark. On narrow widths
these groups reflow within each row rather than creating a horizontal scroller.
The mark compares the average with the largest average in the entire unified
registry. Selection does not resize a row. This is a usage comparison, not quota
progress or behavioral severity. Missing averages have no mark; observed zero displays 0.
Partial records carry a small marker. The list's common period, observed-day count
and day-start hour remain visible; the selected notebook supplies further collection
basis in its local disclosure. No per-row legend or repeated progress labels.

Rows must not contain policy-removal controls. Time, status, and a destructive
hover target must never compete for the same hit area.

### 4.2 Search and creation are different intents

Typing in search filters existing rows without mutating policy. A complete valid
unregistered domain exposes an explicit protection-registration action. Enter in
search selects a matching existing row and never registers a new domain. The
registration action opens the single inline domain/goal composer in the search
area, or sends the uncommitted candidate to Main before direct registration is
admitted. Only the form's explicit confirmation invokes registration. An incomplete
query or ordinary search miss does not create a site.

Isolation allowances and recording-settings links live in a separate ledger
management view, not a floating menu. Allowance creation uses the same composer
slot and never excludes recording. Cancel or Escape closes the composer and
restores search focus. Pending work locks its inputs and cancellation; a failed
ACK leaves the draft and error visible. No typing or blur implicitly saves policy.

### 4.3 Ordering communicates recorded usage

When all-site recording is enabled, All is the default context. Protected and record-only sites share one
ordering: completed-window recorded daily average descending, then domain name.
Unknown averages follow known averages. A frequently used unprotected site can
lead the list without entering a separate observation tab. This is not a new
recommendation or classification engine. Average, Today and Name are direct,
keyboard-accessible sort choices. Today uses the recorded current activity-day
amount with its own comparison maximum; Name uses stable domain order. Choosing
another sort never substitutes today's amount for a missing completed-day average.

Search and policy filtering do not rescale the row surfaces. A presentation
snapshot keeps values, order and maximum stable during selection-bound editing
and background polling. Selection, registry membership or completed-window/day-
boundary changes establish a new comparison. All themes share these semantics.
Bounded row rendering and viewport favicon enrichment remain in place.

### 4.4 Scope switching is a context change

All and Protected are the only list filters, owned by SitesTab, and appear only
for all-site recording. Protected-only and disabled recording show the protected
settings list with no redundant filter. Isolation allowlist management remains in
the separate ledger management view; it is not a recording category. Changing
filter clears search/composer state and retains a selected site only if it belongs
to the requested filter; otherwise it clears selection. An empty filter stays empty.
Policy changes while viewing All
retain that context; existing route and mutation owners retain selection control.

## 5. Usage semantics

The registry uses the last seven **completed activity days** at the configured
day-start hour; the current partial day is excluded. Its average is recorded
active time divided by one common count of activity days with any collection
observation. It is not an average over just the days a particular site was used.
The list caption exposes the actual period, common n/7 count and day-start hour.
The selected notebook provides the calculation basis in a native disclosure.

Sites with evidence on only some dates are marked partial. A recorded zero is
valid; a site with no evidence in the window remains Collecting records. Entirely
unobserved days are excluded from the denominator. Current persisted facts do
not prove continuous tracking coverage for every domain, so this is explicitly a
recorded normalized amount: missing usage is never estimated, and partial values
can understate actual use. A collecting site never borrows today's usage.

The union includes protected settings and currently admitted observed or historical
sites in the completed window. Protected settings remain manageable when their
recording is disabled. Denied rows have no usage surface, numeric zero or collecting
label, and historical-only sites outside current admission are not restored.
Managed roots own their subdomains through the longest matching root. No new
permissions, storage setting, automatic registration or recommendation is added.

Current-day `Observed` and timeline-based `Protected charge` retain their separate
DTO fields and detail labels. The global cap compares protected charge across
completed days; the registry compares all recorded active use regardless of
policy. Row surfaces and individual site goals do not allocate the global cap.

## 6. Decision workspace contract

The observation notebook follows `state -> evidence -> decision`.

- State: current policy, observed amount, protected progress, and target room.
- Evidence: recent trajectory, qualified recurring-time evidence, and
  entry/return/intervention facts.
- Decision: apply a deliberate daily target, protect, leave open, or continue observation.

The default decision surface does not present today's 24 hourly buckets or the
last seven date totals as a recurring habit. A recurring time claim is eligible
only through the selected-detail stats DTO described in the read/query
contract. When that DTO is unavailable, the default surface omits the claim;
presentation may expose the named unavailable state only as supporting evidence
or diagnostics. It never derives a substitute from `todayHourly`,
`habitHourly`, or weekday labels.

The shared analytical reading starts with observation scope, one qualified feedback
sentence and at most two measurements from that same claim. The classification
label is not repeated. Evidence replaces content in the same area, with range and
a short explanation. Additional terminal claims and 30-day recurrence remain
domain outputs, not a release disclosure or a claim about the recent hourly field.
Diagnostic model score/confidence are not exposed as a user assessment. Missing,
observed-zero and unclassified records have complete, distinct reading states;
the UI does not synthesize recommendations or facts.
Other themes' notebooks identify the selected site once above the reading, with the site
switcher alongside it and Back in the compact page toolbar. The ledger is hidden
during this reading, so the selected identity does not compete with a second
visible domain header. Immediately beneath the identity, a compact policy band
groups the protection state and visibly labelled daily limit. Recording and
protection have separate controls and inline reviews. Recording-disabled sites keep a quiet saved-cap inspection and
management band in this position; their policy-only body follows instead of an
analytical reading. The band does not repeat that body's protection mark, title or
protect action. Policy status and behavioral severity remain separate.

### Zen minimal reading

Zen uses one open background without nested paper/card frames. The domain and
site-protection status/action share the top line. Changing sites goes through Back and
the ledger; there is no detail-level site switcher or decorative protection mark.
The action invokes the existing protect command or confirmed release guard. Status
reflects saved membership throughout the release grace and exposes cancellation.

Today's headline and final ledger row share calendar-day 00–24h facts. The saved
site cap and remaining budget use the separately stated reset-hour activity day;
they never subtract calendar-day usage from the policy charge. Recording stays
beside identity in its own row. The existing cap owner uses an anchored editor
that leaves its saved-value trigger and the ledger's geometry in place.

One ledger grows by calendar date, oldest first, with 24 hourly cells per row.
Cell darkness expresses recorded active time; the average row includes recorded
zero and excludes missing dates. Today remains an unfinished final row outside
historical annotations, gutter marks and averages. A first-day reading shows only
today; leading missing dates collapse before the first observed date. The field,
slip and their targets remain within the existing horizontal canopy exclusion
throughout scrolling, preserving the bonsai's intrusion without obscuring text.

Annotations appear only for the producer's admitted patterns, in its given order,
plus available earlier/recent change. Each names its scope, criterion and
denominator. Zero, one or several annotations share the same layout; no fixed
slots or representative form label are filled. Early records show pooled
completed-session counts without claiming repetition. First-day notes consume
the terminal `todayNotes` DTO in producer order. The UI neither admits patterns
nor ranks them, and does not reconstruct visit intervals or session starts.

Selecting an annotation changes the same field's matching rows, window emphasis
and row-end criterion values. Selecting a row unfolds that date's supplied facts
in a daily slip. Missing, recorded zero, insufficient history, no admitted
repetition and explicit unloaded records retain distinct states. Escape closes
the slip and restores row focus before clearing annotation focus. Period and
coverage remain visible; collection and interpretation limits use a native basis
disclosure. The canonical owners are `ZenSiteUsageReading`,
`ZenSiteLedgerAnnotations`, `ZenSiteLedgerField`, `ZenSiteDaySlip`,
`ZenSiteLedgerGlyph` and `zenSiteLedgerFormat`. P4 removes the disconnected
reading/graph components, isolated helpers and unused copy after consumer checks.

Remaining/excess time uses the saved
registry entry's `protectionBudget` (`activity-day-charged`), never observed usage
minus the goal or an edit draft. Comparison is shown only for an admitted protected
site with an available positive cap and matching committed setting. Exact equality
is limit reached; positive sub-minute differences remain sub-minute values.
When recorded usage differs from charge, a short protected-charge note explains
the distinction beside the limit. Denied recording retains saved-cap inspection
and an explicit inactive reason, without invented analytics.

Charge is the V2 recorded `protectedActive` fact, projected from
`hourlyProtectedActive` at the saved reset hour by `projectProtectionBudgetWindow`.
Registration takes effect within the current hour after the old active segment
is settled; it never charges earlier observed use. Curve and Site Furin use the
same exact charge, and Global sums recorded charge independently of current
membership. Goal edits and protection release/re-registration preserve counters
and actual delivery receipts. Explicit recording revocation still controls
current read admission; it does not delete historical facts.

### Policy readouts and explicit cap editing

The combined policy appears once in the compact page header: **Protected sites
combined · [duration] / day**. It is scoped to recorded protected sites and does
not act as a quota frame around every ledger entry. Its editable value includes
an explicit value button; global average evidence remains inside editing.

Outside Zen's minimal composition, the selected-site daily limit lives in one policy band immediately below the site
identity and before the reading. Recording/protection controls remain separately
labelled. Its visible label and value make the edit target identifiable.
A protected site's saved cap remains
inspectable when recording is denied; the editor explains its inactivity and disables
the input and Apply action. Exception/record-only states show their canonical policy
state. The ledger and notebook adapt to actual
available width. Notebook reading uses normal vertical scrolling instead of shrinking
its evidence to fit a fixed viewport. Zen's annotations and date rows stay on one
ledger surface; other themes' extended analysis remains reachable without horizontal
clipping.

Other themes replace either value in place with a labelled numeric field, feedback
and Apply/Cancel. Zen keeps its combined-cap form in the retained workspace utility
and uses the anchored site-cap editor described above. Opening focuses the numeric
field and normal Tab order continues through the controls. Apply is explicit and
blank input cannot commit. No slider rail, focus trap or separate average popover
is mounted.

While the current snapshot reloads, the same numeric field becomes read-only
and Apply is disabled. Its draft, focus and caret remain in place; readiness
restores editing without selecting the value again or taking focus from another
control. Query failure, denied recording and saving keep the input disabled.
Neither typing nor submitting during loading can change the draft or policy.

Global average evidence appears inside this editor: protected-use average,
observed n/7 days and its scope. An inline disclosure
contains the actual activity dates, reset hour, current activity-day charge and
calculation basis. Its evidence and missing/zero/partial semantics are unchanged;
the registry's policy-independent average remains a separate metric.

No outside click or blur saves or dismisses the form. Cancel or Escape discards
the draft and restores the
trigger focus. Saving locks edits and dismissal; success settles and closes,
restoring trigger focus when the removed task still owned it. Focus moved to another
connected control is preserved. Failure retains the draft and Retry inside the same editor.
Changing tabs dismisses the editor; the global draft is retained. Changing the
selected domain/membership clears only its local editor, and late responses from
the previous site cannot update the new selection. Global drafts survive site
selection. Returning to the ledger dismisses the local site editor and inline
recording review, and cancels a pending release grace; visible workspace notices
remain authoritative. Current-day charge is never substituted for missing average evidence.

The global setting retains its eight-hour maximum and infinity/zero meaning.
Site goals retain unset zero and existing per-change increase constraints. Site
input previews `resolveSiteGoalChange`; the response's applied value is final.
A site goal above eight hours keeps its real numeric value and remains editable
through direct input. A recommendation opens an editable draft rather than
committing a policy on selection.

Workspace notices use a normal-flow status region, retaining retry/undo and live
announcements. Cap save failures remain in their editor. Protect/release controls
live beside Zen's site identity; recording exclusion has its own labelled row,
inline impact review and local undo. Sites outcomes do not emit global toasts.
Intel contains no quick actions or recommendation controls.
Release confirmation, grace and failed-commit policy retention remain canonical.

Future policy capabilities require an explicit product decision; they do not occupy
the release Intel reading surface.

## 7. Safe release contract

Removing protection or an exception is a consequential policy mutation because
the canonical owner may also remove the site goal, preset assignment, and close
the policy timeline.

The required flow is:

1. initiate from the selected-site detail only;
2. show an impact-specific inline review beside that policy control;
3. keep the canonical policy unchanged during an eight-second grace period;
4. expose a visible Cancel action for the entire grace period;
5. commit once through the settings command owner;
6. preserve the current policy and show an explicit error if commit fails.

Leaving the Sites tab during grace cancels the pending mutation. A hidden tab
must not complete a destructive countdown.

## 8. Read/query contract

The read path has two tiers:

- registry overview: current activity-day values plus a bounded seven-day
  analysis index; it must stay cheap even with a large observed-domain history;
- selected detail: one domain, thirty-day baseline, and explicit transition /
  intervention evidence, loaded only after selection.

All registry rows may exist as cheap DTOs, but analysis work must be bounded.
Selected detail requests use bounded cache and in-flight coalescing. Invalid,
or malformed domain requests fail with coded errors. Excluded and out-of-scope
valid domains return an explicit policy-only detail without historical queries. Missing canonical
facts do not become zero-confidence “healthy” claims.

A same-domain, identical-policy refresh retains the last matching full-detail
DTO while the owner revalidates it. A domain or policy-identity change clears the
old analysis immediately. Recording denial resolves to a policy-only view; cold
admitted selection enters pending. If same-domain revalidation fails, the retained
detail remains visible with the owner error surfaced explicitly; this is one
query state, not a second mirror or fallback cache.

`statsSiteRecurringTimeEvidence.js` owns the selected site's recurring time
evidence. It reads only the exact thirty completed calendar-day projections,
excludes the current partial day, and publishes one explicit DTO on
`intel.recurringTimeEvidence`. A two- or three-hour circular window becomes
available only after at least seven observed days and four active days, with the
same window present on at least three and half of active days. The window must
carry at least forty percent of each repeated day's use and thirty-five percent
of aggregate active use. A single day may not contribute more than half of the
repeated-window evidence. All other cases publish a named unavailable status;
theme and app presentation code must not recompute or widen this contract.

All data remains local to the device.

## 9. Theme contract

Every canonical theme explicitly declares its own `SitesRegistry` and
`SitesTargetPanel` widget loaders. Themes may change material, typography,
motion, and atmosphere, but share the same usage semantics, safe release flow,
controlled scope/selection behavior, and accessibility contract. The common
owner supplies data and intent callbacks; a theme may own a distinct detail
composition instead of merely recoloring a generic card stack. No theme
substitutes another theme's widget as fallback.

## 10. Success criteria

- a user can tell observed use from policy-charged use at a glance;
- list selection and detail context never diverge;
- an empty registry scope stays empty instead of selecting a row from another scope;
- no destructive action is available from a crowded row;
- accidental policy release can be cancelled before any canonical mutation;
- the strongest available evidence leads directly to a comprehensible action;
- large local histories do not cause unbounded analysis or favicon requests;
- all canonical themes can render the same Sites contract independently.

## Recording policy and available decisions

Protection and recording are orthogonal. Normal rows say Protected or Record
only; "Allowed during isolation" is managed separately and never promises privacy
exclusion. Recording exclusions are managed under Settings > Permissions and
recording. The selected-site recording row can add an exclusion through an
explicit inline impact review or open that settings disclosure. A successful
exclusion exposes local undo. Protection registration/moves
never remove an exclusion implicitly. Removing an exclusion applies the current
global scope; it does not promise recording when the mode or consent still denies it.
Existing history remains stored. No automatic historical deletion is introduced.

| Current admission | List | Selected detail | Time caps |
| --- | --- | --- | --- |
| All sites | All / Protected | Canonical admitted analysis | Recorded protected sites only |
| Protected sites only | Protected settings | Analysis for admitted protected domains; policy-only otherwise | Admitted protected sites |
| Off / consent not granted | Protected settings | Policy-only, with recording-settings action | Inactive, saved values retained |
| Excluded domain | Remains if protected | Policy-only | Site cap inactive, excluded from combined usage |

The combined cap reports excluded protected-domain count and scopes its wording
to recorded protected sites when coverage is partial. No background replacement
timer or expanded collection is introduced. Settings and exclusion commands use
the settings command owner and require the actual acknowledgement before reporting
success. Failed writes retain pending intent for an explicit retry.

This patch establishes stable input contracts for future Intel redesign. It does
not introduce new classification, scores, recommendations or inferred actions.

## Intel interpretation authority (2026-09-14)

공통 분석 화면과 Zen의 상세 분석 문장·근거는 엔진의 terminal interpretation을 따른다.
두 화면은 같은 surface ID를 번역·서식화하며 자체 우선순위나
confidence 임계값으로 대표 패턴을 다시 고르지 않는다. 상세 근거의 품질이
누락되면 진단 가능한 계약 오류로 처리하며 confidence를 대용하지 않는다.

관측 없음은 수집 중으로, 관측된 0은 관측 범위 내 활동 없음으로 구분한다.
관측 marker는 하루 전체의 연속 기록을 뜻하지 않는다. 기존 내부 점수는
행동과 목표 마찰이 섞인 진단값이므로 Intel의 위험 숫자·등급으로 공개하지
않는다. 목표 초과만으로 행동 대표 문장을 만들지 않는다. 핵심 근거 영역도
점수 기여 막대 대신 선택된 문장을 뒷받침하는 패턴 근거를 표시한다.

개인 기준 비교의 현재 값은 달력일이고, 보호 한도 조작·청구는 사용자
하루 시작 시각을 따르는 활동일이다. 화면에서 큰 값을 골라 대체하지 않는다.
전체 Intel 리디자인, 새로운 점수, 교정 액션과 추천 엔진 변경은 후속 단계다.

### 기초 분석 교정 (2026-09-14)

현재 사용량 해석과 긴 세션 판정은 목표 한도와 분리한다. 같은 기록에서
한도만 낮춰도 사용량·세션·반복 확인의 기초 해석은 그대로여야 한다.
목표 대비 차이는 정책 맥락으로 표시한다.

한 시간대에 사용이 몰린 것과 하나의 세션이 길게 이어진 것은 다르다.
이어진 사용은 현재 실측 세션으로만 설명하고, 추정 시간대 집계나 과거
세션으로 이를 대신하지 않는다. 평소 기준이 0이거나 비교할 기록이 없으면
증가 배수를 만들지 않는다. 한두 번의 확인이나 겹치는 복귀 카운터만으로
반복 강도가 과장되지 않게 한다. 이 교정은 기초 모델의 의미를 다루며,
위험 점수나 사용 의도 판정을 새로 제공하지 않는다.

### 문맥 분석 교정 (2026-09-15)

짧은 실측 세션은 짧은 사용으로 설명하며 ‘잘 통제했다’고 평가하지 않는다.
긴 실측 세션도 집중의 질이나 사용 의도를 판정하지 않는다. 같은 날 탐색이나
복귀가 함께 기록되면 그 사실을 설명하되, 긴 세션 도중 일어난 일로 연결하지
않는다. 이 의미는 엔진에서 정하고 UI는 번역과 서식만 담당한다.

자주 사용하는지는 관측된 날짜별 기록으로 판단한다. 주간 시간대 합계만으로
매일 같은 시간에 사용하거나 여러 밤 반복했다고 표현하지 않는다. 심야는 고정
시각 구간이며 개인 수면 시간과 동일시하지 않는다. 백그라운드 채널은 서로
겹칠 수 있어 합산된 주의력·사용 시간처럼 표시하지 않는다. 오늘/주간 범위는
엔진이 지정한다. 하루 급등이나 비교 기간이 비어 있는 기록을 지속 상승으로
승격하지 않는다. 증가 자체에도 실패·위험의 의미를 부여하지 않는다.

이번 단계에서는 내부 판정과 기존 설명을 교정한다. Intel 배치, 새 사용자
점수와 맞춤 행동교정 액션은 후속 설계 범위다.

### 사건·모집단과 복합 판정 교정 (2026-09-15)

같은 날 접속·이동·짧은 세션이 함께 나타나도 시간 순서를 아는 것처럼
표현하지 않는다. 경로는 방향별 횟수이며, 탭이 많은 환경과 이 사이트의
중복 탭은 구분한다. 분모가 없는 탭 진입 비율은 제공하지 않는다.

개입 구간의 재방문과 떠나기 선택은 서로 다른 관측이다. 계속 이용을
실패로 점수화하거나, 재방문이 아직 없다는 이유로 교정 성공을 선언하지
않는다. 같은 재방문의 5분·30분 중복 집계나 여러 라벨이 점수·신뢰도를
늘리지 않는다. 오늘과 주간 근거의 범위는 엔진이 지정하며 UI가 합치지
않는다. 내부 분석은 v5이며, 사용자 위험 점수와 Intel 리디자인은 별도다.


### Intel의 문장·근거 출력 계약 (2026-09-15)

`site-pull-interpretation-v3`는 대표 문장 하나, 같은 주장을 뒷받침하는
실제 시간·횟수 최대 두 개, 펼쳐볼 근거의 순서를 지정한다. 신뢰도 퍼센트나
다른 패턴의 수치로 빈 자리를 채우지 않는다. 값에는 관측 기간을 붙이며
0과 미확보 값을 구분한다. 1분 미만의 양수 사용은 0분으로 표시하지 않는다.
각 주장에는 정본 descriptor의 `explanationKey`가 포함된다. 관찰과 해석 이유를
먼저 설명하고, 필요한 기준·한계 설명이 뒤따른다. 미확보 비교 기준은 별도의
설명으로 구분하며, UI가 점수나 검출 임계값을 재계산하지 않는다.

같은 60분도 한 번의 긴 세션과 여러 짧은 세션에서 다른 근거가 나온다.
Composer가 짧은 세션을 근거로 삼았다면 해당 횟수를 보여주고, 관계없는
재방문 0회를 주요 이유로 앞세우지 않는다. 정책 초과·목표 미설정은 행동
대표 문장을 차지하지 않으며 기존 정책 편집/확인 절차에 남는다.

기록이 전혀 없는 상태, 기록상 활동이 없는 상태, 활동은 있지만 뚜렷한
대표 패턴이 없는 상태를 서로 다른 문장으로 표현한다. 마지막 상태에서도
확보된 시간대 기록을 확인할 수 있다. 수집 불허/제외의 policy-only 화면과
조회 대기·실패는 이 세 분석 상태와 별개의 기존 상태를 유지한다.

집계만으로 의도·해로움·교정 성공을 설명하지 않는다. 자세한 설명에는
같은 날의 동시 출현, 미확인 방문 순서, 전체 브라우저 탭 맥락, 정밀 기록
부재와 개입 후속 관측의 한계를 연결한다. 모델이 공개하지 않은 비교 날짜는
UI가 추정하지 않는다. 이 출력 계약을 소비하는 현재 화면 구성은 아래
Intel reading surface 절을 따른다.


## Intel reading surface (2026-09-15)

### Zen default composition (2026-10-11)

Zen's selected notebook is one open ledger within the registry/notebook spread.
Favicon/domain, protection and recording controls precede today's calendar-day
total, completed-session count and saved site cap. The combined protected-site
cap remains in the page toolbar. The notebook has no site switcher; Back restores
the registry's selection and focus. Cap edits keep the existing command owner
and use an anchored form without moving the saved-value trigger or document.
Remaining/over-limit status still uses policy charge, never observed-use subtraction.

Completed-date rows consume the selected-detail `longTermPatterns` contract:
exactly 30 calendar dates before today, with 24 recorded hourly values for each
observed date. The observed-date average includes zero-use dates and excludes
missing dates. Admitted patterns appear as annotations in producer order, with
matching gutter marks on their dates; available change compares the two exact
15-date halves. The existing seven-recorded-day/four-active-day admission and
three-day/half-of-active-days repetition criteria remain producer owned.

The today line and unfinished final row use calendar-day facts, not activity-day
cap charge. Before any completed observed date, terminal `todayNotes` supplies
ordered session, time-window, visit-interval and pause-screen facts when available.
Early pooled counts do not claim repetition. Missing, zero, insufficient history,
unclassified and unloaded states are explicit, without filling fixed summary slots.
The activity-day cap names its separate reset-hour interval; a pending independent
usage snapshot also retains that explicit basis and never supplies ledger cells.

Annotation selection highlights its supplied dates/window and changes row-end
evidence values on the same field. A date opens a daily slip below the field;
Escape closes it and returns focus before clearing annotation focus. Criterion
evidence retains whole-second durations and downward-truncated shares so
formatting cannot imply that a threshold was met. A window crossing midnight
names both segments of the same recorded calendar date. The field, slip and
click targets share the bonsai canopy's horizontal ink exclusion while scrolling.
Basis uses a native disclosure, and presentation intent survives a same-domain
refresh without becoming a data cache. P4 removes the disconnected components,
clock-color path and unused copy; it changes no data or admission rule.

### Shared analytical reading

Other themes' selected panels retain an independent basic-statistics readout from the
canonical Sites registry snapshot: recorded current activity-day usage and the
recent completed-day average, with its date window, reset hour and observation
denominator. This readout remains available when detailed analysis is pending,
fails, has no admitted label, or cannot render. A missing average is collecting,
not zero. This supporting readout follows the reading and hourly field; the
interpretation continues to use its own calendar-day facts.
Detail errors and retry appear once beside the reading, with the owner error code;
a retained-detail refresh failure leaves the previous reading visible.

The current Intel composition replaces the former verdict/usage/rhythm/driver
stack. It presents observation scope, one engine-selected sentence and up to two
measurements from that same claim as one open surface. The active-day average,
trend status and classification heading do not repeat above it. The policy band
precedes the reading beneath the selected site's identity; the combined cap remains
page-level and the ledger is hidden while the notebook is open.

A measured duration or event count is a number, not a fabricated timeline.
Only explicitly named current/reference pairs and canonical trajectory averages
receive comparison bars. Both start at zero and share the maximum of those two
values; this scale is local to the comparison. The named rows align their labels,
number/unit pairs and bars on this common scale instead of scattering two separate
metric cards. On narrow widths the bar moves beneath its own label and value.
No percentages, independent
count comparisons, goal lines or risk colors are synthesized. Actual zero
references remain zero. Unavailable references have no bar.

Summary and Evidence directly select the same reading area. The current
headline and up to two terminal-selected measurements remain the anchors; Evidence
adds source range, the descriptor's observation explanation first, followed by
the relevant short limitation or reference semantics. The interpretation v3 owner
validates explanation keys alongside metric provenance; UI copy cannot replace
the admitted reason. Headline, measurements and their explanation form one
editorial reading with clear type hierarchy and content-sized spacing. Measurements
follow their sentence in the same reading flow; numbers and units remain visually
distinct without placing related evidence in a separate distant column.
The full expanded terminal claim list remains domain data, not a release carousel
or long disclosure. Historical/hourly tables and the Intel action footer are removed.
Missing, observed-zero and unclassified readings are complete states, separate from
loading, failure and recording-disabled policy-only mode.

All theme target widgets explicitly consume SiteDecisionWorkspace. Shared reading
semantics remain separate from each theme's material and typography. Zen's
ledger uses the existing washi, ink and moss tokens without a decorative protection
mark. Its controls and all 24 hourly cells must remain reachable at the declared
wide, low and narrow viewports; hiding overflow is not an acceptable fit.
Other themes' Summary/Evidence analysis retains normal notebook scrolling and
reflows within the reading body. No reading has horizontal overflow. Same-site
refresh retains the reading and focus.

The query publishes site-intel-temporal-context-v1 on full selected detail only.
Its recent_usage projection preserves habitHourly calendar-day totals including
today. Today usage and visits preserve separate units, sources and same-date ranges.
The display links only exact terminal todayMs/todayTotalMs active usage or todayVisits
navigation-entry evidence; it checks the declared range and recorded total. When
the first primary metric is linkable, that field is already present in Summary.
Opening Evidence or inspecting a secondary metric preserves the chart's period,
unit and selected hour. Other primary aggregates retain clearly labelled recent
context, without guessed occurrence times.
A 30-completed-day recurrence verdict is never painted onto this seven-day field.

The field uses a fixed 00–24 axis and a zero-based, distribution-local maximum.
Its heading groups the range, observation count and evidence/context relationship;
visible exploration help occupies the same readout area that later shows a selected
hour's exact value. It is not confined to a hidden accessible description.
Hourly buttons share one roving keyboard stop; click, arrows and Home/End expose an
exact one-line value. Missing records and recorded zero are different states;
sub-minute positives are never zero. Coverage counts days with records, not full-day
or continuous hourly coverage. No new collection, polling, setting or model input is
introduced. Same-site refresh retains page, graph selection and focus; domain changes
reset the page. Contract failures remain local and recover on fresh admitted details.

Ledger selection opens the notebook without moving or resizing a list row.
Returning to the ledger restores its previous query, ordering and row focus.
Motion respects reduced motion preferences; motion itself does not start queries,
mutate site policy or reinterpret recorded evidence.

The adopted release scope and schedule-only blueprint are recorded in
[Observation workspace](site-intel-observation-workspace-proposal.md).


## Zen single-sheet reading revision (2026-10-12)

The accepted single-sheet design supersedes the persistent notebook registry spread
and overview → evidence → day drill-down. Root ledger is explicit site selection;
selected-domain reading removes the permanent registry column. Dates and the selected
day coexist when at least four normal-size rows and the day region fit. Compact
reading starts with the selected day; its date control replaces the same region with
all calendar dates. Day, hours and session length are sibling choices. Back returns
from domain to ledger to Pond, without unwinding these choices. Criteria/date pickers
consume their own dismissal before the enclosing workspace.

Initial selection is observed today, otherwise latest observed calendar day including
observed zero, otherwise missing today. Explicit date/hour/page/annotation intent
survives query withdrawal, refresh and resize. An expired selected date is shown as
outside the window with an explicit date-choice action; it never silently jumps.
Dates always show total usage; annotations highlight evidence without replacing that
measure. Hourly paint appears only in the requested hourly reading, not every date
row. Consecutive missing runs may group in the shared overview; the date picker
exposes every individual date. No collection, settings, persistence or interpretation
criteria change. Site policy/recording/cap editors retain existing command owners in
the domain management disclosure, and cap activity-day scope stays distinct from
calendar-day records.
