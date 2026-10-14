# Popup + Overview + Garden Experience PRD

- Status: Draft
- Date: 2026-03-07
- Scope: Popup quick-protect flow, dashboard home IA, Garden positioning, and entry-to-retention user journeys
- Depends on:

- Owner: popup product
- Last validated against code: 2026-03-16
- Path policy: planning-allowed

  - `docs/product/dashboard/basic-mode-automatic-protection-prd.md`
  - `docs/product/dashboard/basic-strategy-orchestrator-prd.md`
  - `docs/product/garden/garden-ambient-system-prd.md`
  - `docs/product/dashboard/pro-mode-policy-studio-prd.md`
  - `docs/archive/evidence/protection-cutover-report.md`
- Non-goal:
  - protection engine core architecture 재설계
  - Garden renderer 리빌드
  - advanced policy editing UI implementation

## 0) Current Implementation Update

This document contains earlier `Overview + Garden` separation thinking.

Current dashboard implementation baseline is:

- `HOME` is the top-level entry surface
- `Garden` is not a standalone top-level tab
- `HOME` contains two internal pages: `Scan` and `Reflect`
- `Scan` is fixed as `left pond / right daily risk desk / bottom activity graph`
- `Reflect` is fixed as `left numeric review / right existing theme core status`
- In Zen, the right surface uses the existing `ZenCoreStatus` instead of a Home-only custom bonsai widget

Implementation reference:
- `docs/product/dashboard/home-scan-reflect-structure.md`

## 1) 제품 한 줄 정의

`Popup은 결심을 잡는 곳이고, Overview는 신뢰를 쌓는 곳이며, Garden은 사용자가 이 앱을 계속 켜두고 싶게 만드는 정서적 공간이다.`

## 2) 왜 이 문서가 필요한가

현재 제품은 구조적으로는 많이 정리되었지만, 사용자가 처음 만나는 경험은 아직 분산되어 있다.

- 팝업은 빠르지만 너무 block-first다
- 메인 대시보드는 공들인 세계관은 잘 보이지만, 기본 사용자가 기대하는 핵심 정보가 첫 화면에서 바로 안 잡힌다
- 연못/분재/시그널 스캐너는 분명 강점인데, 어디에 어떤 강도로 배치해야 가장 효과적인지 아직 명확하지 않다

이 문서의 목적은 아래 세 가지를 한 번에 맞추는 것이다.

1. `최소동선 사용자`가 바로 등록할 수 있어야 한다
2. `설득되는 사용자`가 이 앱의 효과와 완성도를 믿게 해야 한다
3. `정원`은 장식이 아니라 차별화 자산으로 살아야 한다

## 3) 제품 북극성

사용자가 궁극적으로 느껴야 하는 것은 아래 한 문장이다.

`그냥 사이트 등록하고 목표 시간만 정했는데, 거슬리지 않게 조금씩 줄어든다.`

이 북극성에 비추면:

- Popup은 `차단`보다 `등록과 결심`을 도와야 한다
- Dashboard 기본 홈은 `설정실`보다 `효과와 진행률`을 보여줘야 한다
- Garden은 `기능 핵심`은 아니지만 `제품 신뢰`와 `지속 사용`에 매우 중요하다

## 4) 정원 자산의 역할 재정의

연못/분재/시그널 스캐너는 단순 시각 장식이 아니다.

- 제품이 공들여 설계된 앱이라는 신뢰를 준다
- anti-dopamine 제품 특유의 딱딱함과 처벌감을 낮춘다
- 상태와 데이터를 감성적으로 반영해 사용자가 스스로 돌아보게 만든다

하지만 이 자산이 기본 동선의 첫 화면 전체를 차지하면 문제가 생긴다.

- 로딩 부담이 크다
- 핵심 정보가 뒤로 밀린다
- 사용자가 기대하는 즉시 효용과 어긋난다

따라서 가장 좋은 해법은 `정원을 제거`하는 것이 아니라 `정원의 자리와 밀도`를 재조정하는 것이다.

## 5) 최종 구조 제안

### 5.1 역할 분리

- `Popup`: Quick Protect
- `Overview`: Basic 홈, 진행률과 신뢰
- `Sites`: 사이트별 목표 시간 관리
- `Garden`: 몰입형 감성/반영 공간
- `Progress`: 주간 변화와 효과 확인
- `Policy Controls`: 정책 조율

### 5.2 핵심 결정

- 현재 메인 씬은 기본 홈에서 내려온다
- 기본 홈은 `Overview`가 된다
- Garden은 별도 탭으로 승격한다
- 다만 정원 자산은 완전히 숨기지 않고, Popup과 Overview에 `경량 프리뷰` 형태로 남긴다

## 6) 사용자 동선

### 6.1 최소동선 사용자

상황:
- 지금 보고 있는 사이트를 줄이고 싶다
- 설정을 오래 만지고 싶지 않다

동선:
1. 팝업 오픈
2. 핵심 지표 2~3개 확인
3. 목표 시간 조절
4. `Protect this site` 실행
5. 종료

이 사용자는 대시보드에 들어가지 않아도 된다.

### 6.2 설득되는 사용자

상황:
- 팝업으로 한두 개 등록해 봤다
- “이게 진짜 줄어들고 있나?”를 확인하고 싶다

동선:
1. 대시보드 Overview 진입
2. 이번 주 감소 추세 확인
3. 보호 중 사이트와 진행률 확인
4. Garden snapshot에서 앱의 공들임을 체감
5. Sites에서 추가 사이트 등록

### 6.3 파워유저

상황:
- 자동 보호는 마음에 드는데 더 정밀하게 조율하고 싶다

동선:
1. Basic으로 충분한 신뢰 확보
2. Pro 진입
3. preset, artifact policy, schedule, site override 조정

## 7) Popup 설계

## 7.1 Popup의 역할

Popup은 `차단 도구`가 아니라 `즉시 등록 도구`여야 한다.

한 줄 요약:

`지금 보고 있는 사이트를 바로 보호 대상으로 등록하고 목표 시간을 정하는 가장 빠른 장소`

## 7.2 Popup 정보 구조

### 섹션 A. Current Site

포함:
- favicon
- domain
- 현재 보호 상태

보조 요소:
- 매우 작은 정원 모티프
  - 잔잔한 물결
  - 작은 분재 실루엣
  - 상태에 따라 미세하게 달라지는 ambient signal

원칙:
- 풀 씬 금지
- 연출보다 craft signal이 우선

### 섹션 B. Decision Metrics

핵심 지표는 최대 3개가 적절하다.

권장 조합:
- `오늘 사용 시간`
- `최근 7일 평균`
- `이번 주 오프트랙 시간 비중`

이 조합이 좋은 이유:
- 오늘 사용 시간: 즉시성
- 7일 평균: 습관성
- 비중: 상대적 중요도

추가로 넣을 수 있는 후보:
- 최근 7일 최다 사용 시간대

하지만 기본 Popup에서는 3개를 넘기지 않는 쪽이 낫다.

### 섹션 C. Goal Control

포함:
- 큰 목표 시간 컨트롤
- wheel 지원
- drag 지원
- direct input 지원
- quick chips: `15m / 30m / 45m`

CTA:
- `Protect this site`
- 상태 반영형 예시: `Keep under 25m/day`

보조 문구:
- `Starts gently. Tightens only if needed.`

## 7.3 Popup에서 하지 말 것

- preset 선택
- artifact 세부 설정
- overflow reinforcement 정책 선택
- 복잡한 차트
- 장문의 설명

Popup은 `결심 캡처`가 본질이다.

## 7.4 Popup 와이어프레임

```text
+--------------------------------------------------+
| ENTROPY                              Protected?  |
| A quiet guide for this site                      |
+--------------------------------------------------+
| [favicon] youtube.com               ~ waterline  |
| Current site                                     |
| Ready to protect                                 |
+--------------------------------------------------+
| Today            42m                             |
| 7-day avg        58m                             |
| Off-track share  31%                             |
+--------------------------------------------------+
| Goal Time                                        |
|        [   25 min / day   ]                      |
|      15m      30m      45m                       |
| Starts gently. Tightens only if needed.          |
+--------------------------------------------------+
| [ Protect this site ]                            |
| [ Open dashboard ]                               |
+--------------------------------------------------+
```

## 8) Dashboard 기본 구조

## 8.1 기본 홈은 Overview

현재 메인 씬이 바로 전면에 오는 구조는 차별화에는 좋지만, 기본 사용자가 기대하는 1차 가치와는 약간 어긋난다.

Overview의 역할은 아래 세 가지다.

- 이 앱이 실제로 효과가 있다는 신뢰 제공
- 지금 무엇이 보호되고 있는지 빠르게 파악
- 더 깊게 들어갈 경로를 자연스럽게 안내

## 8.2 Overview 정보 구조

### 섹션 A. Hero Summary

핵심 카드:
- `이번 주 줄어든 시간`
- `오늘 목표 달성 상태`
- `현재 보호 상태`

이 Hero는 “좋은 앱인지”보다 “실제로 도움이 되는지”를 먼저 말해야 한다.

### 섹션 B. Protected Sites Strip

각 사이트별:
- domain
- 오늘 사용 시간
- 목표 시간
- 진행률
- 상태 배지

목적:
- Sites 탭에 들어가기 전에도 현황을 훑게 한다

### 섹션 C. Garden Snapshot

여기가 중요하다.

Garden을 홈에서 완전히 제거하지 말고, `경량 라이브 프리뷰`로 둔다.

포함:
- 현재 연못/분재 상태 미리보기
- 한 줄 해석 문구
  - 예: `Today is calmer than last week.`
  - 예: `Pattern pressure is rising this afternoon.`

CTA:
- `Open Garden`

### 섹션 D. Weekly Progress

보여줄 것:
- 최근 7일 추세
- 목표 초과율 변화
- 가장 많이 줄어든 사이트

목표:
- 사용자가 “자연스럽게 줄고 있다”를 체감

## 8.3 Overview 와이어프레임

```text
+--------------------------------------------------------------+
| This week you saved 1h 42m                                   |
| Protection is keeping 4 sites within their targets.          |
+--------------------------------------------------------------+
| youtube.com   24 / 30m   | instagram.com 18 / 20m | x.com... |
+--------------------------------------------------------------+
| Garden Snapshot                                               |
| [ light pond / bonsai preview ]                              |
| Today is calmer than last week.                              |
|                                      [ Open Garden ]         |
+--------------------------------------------------------------+
| Weekly Progress                                               |
| Mon  Tue  Wed  Thu  Fri  Sat  Sun                            |
| usage trend / over-limit trend / top site reduction          |
+--------------------------------------------------------------+
```

## 9) Garden 탭 설계

## 9.1 Garden의 역할

Garden은 정보의 주 통로가 아니라 `정서적 인터페이스`다.

역할:
- 상태를 감성적으로 반영
- 제품의 공들임을 보여줌
- 사용자가 스스로 돌아보게 만듦
- punitive mood를 낮춤

## 9.2 Garden 안에서 Signal Scanner 살리기

Signal Scanner 방향성은 버릴 필요가 없다.

추천 구조:
- `Garden` 안에 두 가지 뷰를 둔다
  - `Reflect`
  - `Scan`

### Reflect
- 연못, 분재, 시간대 변화
- 안정감, 흐름, 회복감

### Scan
- 더 기술적인 상태 반영
- pattern pressure
- current protection state
- active artifacts

이렇게 하면:
- 기존 signal scanner 철학은 유지된다
- 기본 홈은 가벼워진다
- Garden은 더 목적이 분명해진다

## 9.3 Garden 상태 매핑

현재 의미는 [Garden Ambient 계약](../garden/garden-ambient-system-prd.md)을 따른다:
- 하늘·구름·비·바람·수면의 기상 반응 = 현지 시간과 계절의 자연 날씨
- 분재의 누적 성장과 최근 생기·개화 = 기존 생명 모델을 통한 습관 피드백
- 비 뒤 낙화 = 관측한 자연 전선의 일회 전이

예산 안정도나 pattern pressure로 날씨·혼탁도·광량을 바꾸지 않는다.
이 문서의 미래 snapshot/ceremony 계획은 공통 weather authority를 덮어쓰지 않는다.

원칙:
- 과장된 보상 연출 금지
- 도파민적 축하 장치 금지
- 조용하고 오래 보고 싶은 공간이어야 함

## 9.4 Garden 와이어프레임

```text
+--------------------------------------------------------------+
| Garden                          [ Reflect ] [ Scan ]         |
+--------------------------------------------------------------+
|                                                              |
|                 live pond / bonsai scene                     |
|                                                              |
|  Calmness: stable                                            |
|  Pattern pressure: medium                                    |
|  Afternoon drift is slightly elevated.                       |
|                                                              |
+--------------------------------------------------------------+
| Today: 52m / 70m     This week: -18% over-limit             |
| Active: Time Anchor armed                                    |
+--------------------------------------------------------------+
```

## 10) 성능 원칙

정원은 렌더링 티어를 나눠야 한다.

### Tier 0
- 정적 이미지/포스터

### Tier 1
- 경량 SVG/CSS ambient
- Popup과 Overview snapshot에서 사용

### Tier 2
- 풀 인터랙티브 씬
- Garden 탭에서만 사용

적용 원칙:
- Popup: Tier 1
- Overview snapshot: Tier 1
- Garden tab: Tier 2

이렇게 해야 craft는 보이지만 기본 동선은 무겁지 않다.

## 11) 정보 우선순위 원칙

기본 사용자 기준 우선순위는 아래가 맞다.

1. `이 사이트를 보호할지`
2. `오늘 얼마나 쓰고 있는지`
3. `목표 안으로 들어가고 있는지`
4. `이 앱이 공들여 설계됐는지`
5. `더 깊게 들어가고 싶은지`

즉 정원은 중요하지만 4순위다.

정원이 1순위로 올라오면:
- 앱의 중심 가치가 흐려지고
- 기본 사용자는 핵심 효용을 놓친다

## 12) 제품 톤

이 앱은 사용자에게 “혼나는 도구”처럼 느껴지면 안 된다.

권장 톤:
- calm
- precise
- intentional
- crafted

피해야 할 톤:
- punitive
- gamified reward
- dark pattern
- productivity shame

## 13) 구현 우선순위

### Phase 1
- Popup을 goal-first 구조로 재설계
- Overview를 기본 홈으로 전환
- Garden snapshot card 추가

### Phase 2
- Garden 탭 분리
- Reflect / Scan 모드 도입
- Tiered rendering 적용

### Phase 3
- Popup ambient motif와 Garden snapshot의 상태 연동 강화
- Overview와 Progress의 설명 문구 정교화
- Basic -> Pro 진입 흐름 정리

## 14) 최종 결론

가장 이상적인 구조는 아래와 같다.

- Popup은 `지금 이 사이트를 보호할까`를 가장 빠르게 결정하게 한다
- Overview는 `이 앱이 실제로 효과가 있다`는 신뢰를 준다
- Garden은 `이 앱을 계속 켜두고 싶게 만드는 정서적 공간`으로 분리된다
- Signal Scanner는 사라지는 것이 아니라 Garden 내부의 `Scan mode`로 재배치된다

즉 정원은 메인 기능을 방해하지 않으면서도, 이 앱이 평범한 차단 유틸이 아니라는 사실을 가장 강하게 증명하는 자산으로 남아야 한다.
