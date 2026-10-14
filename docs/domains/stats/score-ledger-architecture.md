# Score Ledger Architecture

- Status: Active
- Owner: stats domain
- Last validated against code: 2026-06-10
- Path policy: current-only
- Canonical for: explainable user-rule scoring ledger and score feedback basis

이 문서는 Entropy 점수 시스템의 1차 기준을 정의한다. 핵심은 사용자를 평가하는 점수가 아니라, 사용자가 스스로 정한 기준을 얼마나 지켰는지 설명 가능한 원장으로 보여주는 것이다.

## 1) 제품 원칙

1. 점수는 처벌이 아니라 피드백이다.
2. 주요 감점은 사용자가 직접 설정한 기준에서만 나온다.
3. 산만함, 멀티태스킹, 전환 빈도 같은 패턴은 기본적으로 중립 관찰이다.
4. 미관리 사이트는 작은 검토 신호로만 반영하고, 강한 처벌로 쓰지 않는다.
5. 어디서 몇 점이 깎였는지 항목 단위로 추적 가능해야 한다.
6. 회복 신호는 빠르게 반영하되 총점은 100점을 넘지 않는다.
7. 상시 UI의 주 피드백은 숫자 점수가 아니라 분재/정원의 감각 상태다.
8. 점수 원인은 hover, click, detail button 같은 명시적 탐색에서만 노출한다.

## 2) Canonical Code Path

현재 순수 모델의 canonical path는 다음이다.

- `src/domains/stats/analysis/scoreLedger.js`
- public export: `src/domains/stats/analysis/index.js`
- retired dashboard scoring compatibility export is intentionally absent

기존 점수 함수는 호환성을 위해 유지한다.

- `calculateDigitalWellnessScore()`
- `calculateDigitalWellnessBreakdown()`

단, 이 함수들은 내부적으로 score ledger를 만들고 다음 필드를 추가로 반환한다.

- `ledger`
- `scoreSummary`
- `scoreInsights`
- `displayScore`
- `scoringMode`
- `criteriaCoverage`

## 3) Ledger Entry Contract

각 원장 항목은 다음 의미를 가진다.

```js
{
  type: 'global_goal_over_limit',
  category: 'user_rule',
  subject: 'global_goal',
  basis: 'user_defined_global_goal',
  severity: 'warn',
  rawPoints: -23,
  points: -23,
  metrics: {
    usedMinutes: 90,
    goalMinutes: 60,
    overMinutes: 30,
    ratio: 1.5
  }
}
```

규칙:

- `points < 0`: 실제 감점
- `points > 0`: 회복/준수 credit
- `points === 0`: 중립 관찰 또는 설정 안내
- `rawPoints`: cap 적용 전 점수
- `points`: cap 적용 후 실제 반영 점수

## 3.1) Scoring Mode Contract

`score`는 기존 호환성을 위해 항상 숫자로 유지한다. 하지만 사용자에게 숫자로 보여도 되는지는 `displayScore`와 `scoringMode`가 결정한다.

- `scored`: 사용자가 정한 기준이 있어 실제 채점 가능한 상태. `displayScore`는 숫자다.
- `partial`: 일부 기준은 있지만 오늘 활동 중 명시적 기준 아래 있는 비율이 낮다. `score`는 내부 호환값이고 `displayScore`는 `null`이다.
- `observation_only`: 사용 기록은 있지만 사용자 기준이 없다. `score`는 내부 호환값이고 `displayScore`는 `null`이다.
- `quiet`: 채점할 활동이 없다. `score`는 내부 호환값이고 `displayScore`는 `null`이다.

UI와 분재 생명력은 `displayScore`가 `null`인 상태를 100점으로 해석하면 안 된다. 이 상태는 "잘함"이 아니라 "아직 채점하지 않음/조용함"이다.

### Coverage Gate

숫자 점수는 오늘 활동 중 명시적 기준이 적용되는 비율이 충분할 때만 노출한다.

- 기준 적용 비율: `criteriaCoverage.coveredActiveMs / criteriaCoverage.totalActiveMs`
- 출시 기본값: `criteriaCoverage.minDisplayRatio = 0.6`
- 비율이 낮으면 `scoringMode = partial`, `displayScore = null`
- 낮은 커버리지는 `score_coverage_low` 관찰 항목으로 남긴다

기준이 없는 사용은 감점하지 않는다. 대신 기준 없는 사용이 많으면 100점처럼 보이지 않게 만든다.

## 4) Categories

### `user_rule`

사용자가 정한 전역 목표 시간 기반 감점이다.

예:
- 오늘 보호 대상 사이트 총량이 전역 목표를 초과함

### `site_rule`

사용자가 정한 사이트별 제한 시간 기반 감점이다.

예:
- `video.example` 제한 20분 대비 45분 사용

### `unmanaged_review`

미관리 사이트 사용량이 눈에 띌 때 생성되는 작은 검토 신호다.

규칙:
- 사용자가 직접 정한 기준이 아니므로 cap이 작다.
- 목표는 감점보다 "이 사이트를 관리 대상으로 둘지 검토"하게 하는 것이다.

### `recovery`

목표 안에 머문 항목의 회복 credit이다.

규칙:
- 총점을 100점 이상으로 올리지 않는다.
- 기존 감점을 상쇄하는 데만 적용한다.

### `observation`

점수에 직접 영향을 주지 않는 설명 항목이다.

예:
- browsing switches observed
- score criteria missing
- quiet day

## 5) Category Caps

현재 cap은 다음 기준이다.

| Category | Max deduction |
| --- | ---: |
| `user_rule` | 45 |
| `site_rule` | 35 |
| `unmanaged_review` | 8 |

의도:

- 단일 기준 초과가 전체 점수를 전부 파괴하지 않게 한다.
- 미관리 사이트는 강한 처벌이 아니라 검토 신호로 제한한다.
- 점수 하락은 사용자가 이해하고 회복 가능한 범위에 남긴다.

## 6) Score Calculation

기본 점수는 100점이다.

```text
score = clamp(100 - totalDeduction + appliedCredit, 0, 100)
appliedCredit = min(totalCreditAvailable, totalDeduction)
```

따라서 회복 credit은 감점을 상쇄하지만, 점수를 100점 너머로 올리지 않는다.

## 7) Bonsai/Garden Integration Rule

분재나 정원 상태는 raw browsing pattern을 직접 감정 판정으로 쓰지 않는다. 점수 원장은 내부 근거 장부이고, Zen theme은 이를 `ZenBonsaiHabitSignal`로 변환한 뒤 분재 생명력에만 연결한다.

Canonical adapter:

- `src/themes/plugins/zen/model/ZenBonsaiHabitSignal.js`

상시 노출 계층:

- 분재의 활력, 건조함, 꽃, 가지 처짐, 바람 반응

요청형 설명 계층:

- `scoreInsights` 기반 hidden feedback lens
- hover/focus/click 시 오늘의 원인 1-3개만 표시
- 점수 숫자 자체는 렌즈 UI에서 표시하지 않음

권장 매핑:

- `scoreSummary.displayScore`: 활력의 주 입력
- `user_rule + site_rule deduction`: 건조/가지 처짐
- `recovery credit`: 빠른 회복/꽃 회복
- `unmanaged_review`: 낮은 강도의 관찰 신호
- `observation`: 요청형 설명에는 쓰되 분재 시듦에는 직접 연결하지 않음

`scoringMode !== 'scored'`이면 분재는 점수 하락/시듦을 만들지 않는다. 기준 없음/부분 기준은 `calibrating`, 조용한 날은 안정 상태로 표현한다.

## 8) Score Setup Recommendations

추천 기준은 자동 적용하지 않는다. 시스템은 추천 가능한 초안을 만들고, 사용자가 Sites/Rules 화면에서 명시적으로 승인할 때만 `siteGoals`에 반영한다.

출시 기본 준비 조건:

- 최근 7일 중 활성 사용일 3일 이상
- 최근 7일 총 사용 45분 이상
- 이미 `siteGoals`가 있는 사이트는 추천 대상에서 제외
- 기본 대상은 사용자가 등록/관리 중인 사이트이며, 미관리 사이트 추천은 별도 옵션으로만 확장

추천 초안은 사이트별로 계산하지만, 사용자에게는 묶음 상태로만 노출한다. 개별 사이트가 준비될 때마다 알림을 발생시키지 않는다.

현재 UI 경로:

- Home: 점수 기준 커버리지/목표 초안 상태를 작은 chip/action으로만 노출
- Rules: `sitesSnapshot.scoreSetup`을 소비해 준비된 초안을 선택/수정/일괄 적용
- 저장: 기존 site rule command 경로를 통해 `siteGoals`만 갱신

`scoreSetup` read model은 stats analysis/query 계층의 목적별 read-model builder가 소유한다. `statsAnalysisQueryService`는 durable facts와 현재 정책/사이클 컨텍스트를 모아 해당 builder를 호출하는 orchestrator일 뿐이다. Home과 Sites는 각자 받은 `statusSnapshot`/`sitesSnapshot`의 `scoreSetup`을 읽고, UI에서 추천 기준을 재계산하거나 sibling snapshot으로 보정하지 않는다.

## 9) Next Work

1. Sites/Home 화면에서 "오늘 어떤 기준이 분재 상태를 움직였는지"를 요청형 패널로 표현
2. 연속 며칠 회복/악화 추세를 `ZenBonsaiHabitSignal`의 계절감/꽃 회복으로 확장
