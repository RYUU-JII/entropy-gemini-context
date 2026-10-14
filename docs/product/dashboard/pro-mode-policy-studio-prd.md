# Retired Pro Mode Policy Studio PRD

- Status: Hold
- Date: 2026-03-07
- Scope: Historical dashboard pro mode IA + policy customization surface
- Depends on:

- Owner: dashboard product
- Last validated against code: 2026-03-16
- Path policy: planning-allowed

  - `docs/product/dashboard/protection-tab-prd.md`
  - `docs/archive/evidence/protection-cutover-report.md`
  - `docs/archive/legacy-plans/protection-runtime-unified-refactor-master-plan.md`
  - `docs/product/dashboard/basic-mode-automatic-protection-prd.md`
  - `docs/product/dashboard/basic-strategy-orchestrator-prd.md`
  - `docs/product/dashboard/basic-protection-strategy-prd.md`
  - `docs/product/popup/popup-overview-garden-experience-prd.md`
  - `docs/product/dashboard/information-architecture-basic-pro-tabs-prd.md`
- Non-goal:
  - protection engine core architecture 재설계
  - 모든 내부 수치와 weight를 기본 control surface에 직접 노출
  - artifact 세계관/그래픽 리디자인

## 0) Current Product Decision

Entropy no longer names the full control surface "Pro Mode".

- The former Pro surface is now simply the default Entropy workspace.
- Advanced controls remain available, but not behind a mode selector.
- A smaller simplified experience should ship as a separate `Entropy Lite` app rather than an in-app Basic Mode.

## 1) 제품 한 줄 정의

`Pro Mode는 Protection Engine을 직접 재설계하는 모드가 아니라, 보호 정책을 의도적으로 조율하는 Policy Studio다.`

## 2) 왜 필요한가

Basic Mode는 사용자가 목표를 선언하고 시스템이 자동으로 보호를 조절하는 모드다.
이 구조는 대부분의 사용자에게 적합하지만, power-user에게는 다음 니즈가 남는다.

- 사이트마다 다른 보호 성향을 쓰고 싶다
- 특정 시간대나 상황에 따라 정책을 바꾸고 싶다
- artifact를 더 세밀하게 제어하고 싶다
- preset을 저장하고 재사용하고 싶다
- 시스템이 왜 그렇게 동작했는지 더 상세히 알고 싶다

Pro Mode의 목적은 이 요구를 수용하되, 다시 `엔진을 직접 조립하는 혼란`으로 되돌아가지 않는 것이다.

## 3) 모드 체계

### 3.1 Basic

- 역할: 목표 선언
- 사용자 입력: 사이트 목표 시간, 보호 성향, artifact 허용
- 시스템 역할: level, filter reinforcement, artifact timing 자동 조절

### 3.2 Pro

- 역할: 정책 조율
- 사용자 입력: preset, site override, artifact policy, schedule, lane curve
- 시스템 역할: 조율된 policy를 engine plan으로 컴파일
- 기본 진입 조건: Popup/Overview/Basic에서 충분한 신뢰를 얻은 이후

### 3.3 Lab

- 역할: 실험 / 위험 튜닝
- 포함: raw effect parameter, 실험 feature, debug control
- 원칙: Basic/Pro의 기본 UX와 분리

핵심 경계는 이렇다.

- `Basic = 목표를 정한다`
- `Pro = 정책을 조율한다`
- `Lab = 내부 수치를 실험한다`

즉 제품 entry flow는 `Popup -> Overview/Basic -> Pro` 순서가 기준이어야 한다.

## 4) Pro Mode 원칙

### 4.1 강력하지만 설명 가능해야 한다

사용자는 자신이 무엇을 바꾸는지 이해할 수 있어야 한다. `lane`, `preset`, `schedule`, `artifact policy` 수준까지는 허용하되, 엔진 내부 score weight 전체를 그대로 노출하지 않는다.

### 4.2 사이트 중심이어야 한다

Pro Mode의 기본 단위는 `site`다. 사용자는 사이트별 목표와 override를 관리해야지, 모든 정책을 전역 슬라이더로만 다루면 안 된다.

### 4.3 preset 우선 구조여야 한다

Power-user도 매번 처음부터 설정하지 않게 해야 한다. Pro Mode는 개별 조정보다 `preset 기반 조합`이 먼저다.

### 4.4 explainability가 필수다

Pro Mode는 단순 ON/OFF가 아니라 정책을 조율하는 공간이므로, 왜 어떤 개입이 실행됐는지 설명과 리포트가 반드시 따라와야 한다.

### 4.5 raw tuning은 Lab으로 격리한다

Pro Mode는 강력해야 하지만, 무제한 커스터마이즈는 구조를 다시 흐린다. `개별 필터 raw 값`과 `엔진 내부 weight`는 Pro 기본 화면에 두지 않는다.

## 5) 허용 범위

### 5.1 Pro Mode에서 허용할 것

- 전역 preset 선택
- 사이트별 preset override
- 사이트별 목표 시간
- 사이트별 보호 성향
- artifact별 `enabled / autoTrigger`
- artifact 강도 preset
- 보호 곡선(level -> lane intensity) 조정
- schedule/context 기반 policy 전환
- explainability / replay / effectiveness report

### 5.2 Pro Mode에서 숨길 것

- 개별 필터 raw numeric value 전체
- 엔진 내부 weight 직접 편집
- if/then scripting rule builder
- scroll physics 같은 low-level 실험값
- debug action / protocol test controls

### 5.3 Lab으로 내릴 것

- `textRhythm` runtime-profile internals, `inputDelay`, `temporal` raw tuning
- 무한스크롤 물리값
- nudge swarm test trigger
- artifact renderer debug
- internal score multiplier

## 6) 정보 구조

### 6.1 Overview

보여줄 것:

- 현재 활성 preset
- 오늘 주요 개입 요약
- 가장 효과 있었던 artifact
- 목표 초과 사이트
- 최근 policy override

### 6.2 Sites

사이트별 정책의 중심 화면이다.

보여줄 것:

- 목표 시간
- 오늘 사용량
- 현재 preset
- 보호 성향
- overflow reinforcement 정책
- artifact override 여부

핵심 액션:

- 사이트별 목표 시간 조정
- site preset override
- site schedule override
- site artifact override

### 6.3 Presets

전역/사이트별 policy bundle 관리 화면이다.

포함:

- built-in preset
- custom preset 저장
- duplicate / rename / archive
- preset diff 보기

권장 기본 preset:

- `Work Focus`
- `Night Recovery`
- `Social Lite`
- `Hard Reset`

### 6.4 Artifacts

artifact를 단순 ON/OFF가 아니라 `policy object`로 다룬다.

보여줄 것:

- enabled
- auto trigger
- configured-filter reinforcement
- trigger strictness
- cooldown preset
- recent activations

### 6.5 Schedules

시간대와 context에 따라 policy를 전환한다.

보여줄 것:

- weekday/weekend preset
- time window preset
- night strict mode
- work session override

### 6.6 Explain

Pro Mode의 필수 탭이다.

보여줄 것:

- 최근 level 변화 이유
- direct trigger 로그
- artifact activation history
- site별 시간 절감 추정
- 어떤 preset이 어떤 결과를 냈는지

### 6.7 Advanced

policy curve 편집과 고급 override를 둔다.

포함:

- level별 lane intensity
- site-specific threshold override
- advanced artifact policy
- posture reinforcement override

### 6.8 Lab

실험 기능은 별도 진입으로 격리한다.

## 7) 정책 모델

### 7.1 Preset 계층

정책 적용 순서는 고정한다.

`Global Base -> Context Preset -> Site Override -> Runtime Observation`

이 순서가 있어야 Pro Mode가 강력해져도 해석 가능성이 유지된다.

### 7.2 Lane 중심 커스터마이즈

Pro Mode는 개별 filter key가 아니라 lane 중심으로 편집해야 한다.

- `reward`
- `pace`
- `friction`
- `advanced`

권장 편집 방식:

- level별 lane intensity table
- preset별 lane profile
- site별 lane override

예:

| Level | Reward | Pace | Friction |
|---|---|---|---|
| L1 | 1 | 0 | 0 |
| L2 | 2 | 1 | 0 |
| L3 | 3 | 2 | 1 |
| L4 | 3 | 3 | 2 |
| L5 | 3 | 3 | 3 |

### 7.3 Artifact policy

artifact는 `enabled`만이 아니라 아래 정책을 가진다.

- autoTrigger
- strictness
- cooldownPreset
- siteOverride

단, trigger contract 자체를 자유 scripting으로 열지는 않는다.

### 7.4 Schedule / Context policy

preset은 정적 값이 아니라 시간대/context에 따라 바뀔 수 있다.

예:

- 09:00~18:00 Work Focus
- 22:00~02:00 Night Recovery
- weekend는 Social Lite

## 8) 어디까지 커스텀 가능하게 할 것인가

이 질문에 대한 권장 답은 명확하다.

### 8.1 바로 허용할 것

- 목표 시간
- 보호 성향
- preset 저장/적용
- site override
- schedule override
- artifact policy
- level별 lane intensity

### 8.2 신중히 허용할 것

- trigger threshold 세부값
- posture reinforcement 조건 세부 조정
- artifact cooldown 시간 직접 수정

이 영역은 `Advanced` 안에서만 열어야 한다.

### 8.3 허용하지 않을 것

- 개별 CSS filter 수치
- input delay raw millisecond curve
- 엔진 내부 observation weight
- 자유 if/then rule DSL

이건 Pro를 망치고 Lab과 경계를 무너뜨린다.

## 9) UX 구조안

### 9.1 기본 탭

- `Overview`
- `Sites`
- `Presets`
- `Artifacts`
- `Schedules`
- `Explain`
- `Advanced`
- `Lab`

### 9.2 Sites 우측 패널

상단:

- 목표 시간
- 현재 preset
- 보호 성향
- overflow reinforcement policy

하단:

- habit / daily / weekly 통계
- 최근 direct trigger
- 최근 artifact activation

### 9.3 Preset 카드

카드에 반드시 보여줄 것:

- preset name
- intended use
- lane profile summary
- artifact summary
- schedule compatibility

## 10) 추천 서비스 패키지

### 10.1 Built-in preset bundle

- Work Focus
- Study Guard
- Night Recovery
- Social Lite
- Hard Reset

### 10.2 Explainability bundle

- 오늘 왜 level이 올라갔는지
- 어떤 artifact가 몇 번 작동했는지
- 어떤 설정이 시간을 얼마나 줄였는지

### 10.3 Simulation bundle

사용자가 정책을 바꾸면 바로 미리 볼 수 있어야 한다.

예:

- `이 설정이면 YouTube는 80% 시점부터 pace lane이 강해집니다.`
- `이 artifact는 숏폼 진입 시 자동 발동합니다.`

## 11) 단계별 구현 우선순위

### Phase 1

- Pro Mode IA 정리
- preset system 도입
- site override 구조 정리
- artifact policy UI 정리

### Phase 2

- schedule/context preset
- explainability panel
- effectiveness report

### Phase 3

- simulation / preview
- preset import/export
- advanced curve editor

### Phase 4

- Lab 분리
- raw tuning 이관
- debug / experiment 고립

## 12) 성공 기준

- Basic과 Pro의 경계가 명확하다
- Pro 사용자가 preset 중심으로 정책을 조율할 수 있다
- artifact가 단순 토글이 아니라 policy object로 작동한다
- explainability 없이도 불신을 부르지 않는다
- raw tuning은 Lab으로 격리된다

## 13) 최종 결론

Pro Mode는 `세부 설정이 많은 모드`가 아니라 `정책을 다루는 모드`여야 한다.

가장 좋은 구조는 이렇다.

- `Basic = Automatic Protection`
- `Pro = Policy Studio`
- `Lab = Experimental`

이 경계를 지키면 제품은 단순함과 강력함을 동시에 가질 수 있다.

## 14) Basic과의 관계 재정의

Pro Mode는 별도의 제품 철학이 아니라, `Basic Strategy Orchestrator`를 설계하는 Policy Studio다.

연결 문서:
- `docs/product/dashboard/basic-strategy-orchestrator-prd.md`

정리:
- Basic은 목표 시간 기반 자동 운용이다.
- Pro는 그 자동 운용이 어떤 전략 번들을 쓸지 조율한다.
- 따라서 Pro preset은 결국 Basic orchestration의 입력 자산이다.
