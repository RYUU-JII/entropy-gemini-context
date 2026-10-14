# Information Architecture PRD: Retired Basic/Pro Tabs

- Status: Hold
- Date: 2026-03-07
- Scope: Historical dashboard top-level tabs for the retired in-app Basic/Pro mode split
- Depends on:

- Owner: dashboard product
- Last validated against code: 2026-03-16
- Path policy: planning-allowed

  - `docs/product/dashboard/protection-tab-prd.md`
  - `docs/product/dashboard/basic-mode-automatic-protection-prd.md`
  - `docs/product/dashboard/pro-mode-policy-studio-prd.md`
  - `docs/product/popup/popup-overview-garden-experience-prd.md`
  - `docs/product/dashboard/basic-strategy-orchestrator-prd.md`
- Non-goal:
  - 개별 탭 내부 UI 구현 상세
  - theme-specific visual redesign
  - engine core contract 재설계

## 0) Current Implementation Update

Current product decision:

- Entropy no longer exposes an in-app Basic/Pro mode split.
- The full control surface is the default Entropy workspace.
- A smaller simplified experience belongs in a future standalone `Entropy Lite` app, not inside this app as a mode selector.

The earlier standalone `Garden` direction in this document is not the current home implementation baseline.

Current dashboard home structure is:

- top-level `HOME`
- internal `Scan / Reflect`
- no standalone `Garden` tab
- `Scan` = `pond + daily risk desk + activity graph`
- `Reflect` = `numbers + existing theme core status`

Implementation reference:
- `docs/product/dashboard/home-scan-reflect-structure.md`

## 1) 한 줄 결론

`Filter는 최종적으로 사용자 IA에서 사라지고, Basic에서는 Protection으로 흡수되며, Artifacts는 Basic에서는 Protection 안에 포함되고 Pro에서만 별도 탭으로 유지된다.`

## 2) 왜 이 결정이 필요한가

현재 구조의 가장 큰 문제는 사용자 관점에서 탭 이름과 실제 가치가 완전히 일치하지 않는다는 점이다.

- `Filter`는 구현 언어에 가깝다
- `Artifacts`는 세계관과 감성 자산이라 보여줄 가치가 있다
- 하지만 Basic 사용자에게 `Filter`와 `Artifacts`를 같은 위상으로 병렬 노출하는 것은 과하다
- 메인 씬 자산은 강점이지만, 기본 홈이 되면 정보 우선순위를 흐린다

따라서 최종 탭 구성은 내부 구조가 아니라 사용자 정신모델을 기준으로 다시 정렬해야 한다.

## 3) 사용자 정신모델

기본 사용자는 다음 질문에 답하고 싶다.

1. `나는 얼마나 줄고 있나?`
2. `어떤 사이트를 관리 중인가?`
3. `이 앱이 나를 어떻게 보호하고 있나?`
4. `이 앱은 왜 이렇게 공들여 만들어졌나?`
5. `더 고급 조정을 하고 싶으면 어디로 가야 하나?`

여기에 대응하는 탭이 가장 자연스럽다.

## 4) Basic Mode 최종 탭

권장 최종 구조:

- `Overview`
- `Sites`
- `Garden`
- `Protection`
- `Settings`

### 4.1 Overview

역할:
- 기본 홈
- 효과와 진행률
- 현재 보호 상태 요약
- Garden snapshot

사용자 질문:
- `이 앱이 실제로 도움이 되고 있나?`

### 4.2 Sites

역할:
- 사이트 등록/삭제
- 목표 시간 설정
- 사이트별 진행률 확인

사용자 질문:
- `무엇을 얼마나 줄일 것인가?`

### 4.3 Garden

역할:
- 정서적 반영 공간
- Reflect / Scan 모드
- 세계관/정원 자산의 메인 무대

사용자 질문:
- `이 앱은 나의 상태를 어떻게 비추고 있나?`

### 4.4 Protection

역할:
- 자동 보호 강도
- 현재 보호 상태 설명
- 허용된 artifact 관리
- 최근 개입 요약

사용자 질문:
- `이 앱은 나를 어떻게 보호하고 있나?`

### 4.5 Settings

역할:
- 앱 전반 설정
- 권한, 언어, 테마, 계정 성격의 설정

사용자 질문:
- `앱 자체 설정은 어디서 바꾸나?`

## 5) 왜 Basic에서 Filter를 없애야 하는가

`Filter`는 시스템 구현 개념으로는 유효하지만, 사용자 IA에선 약하다.

Basic 사용자는 이렇게 생각하지 않는다.

- `필터를 조정해야지`
- `artifact를 조정해야지`

대신 이렇게 생각한다.

- `보호가 지금 약한가 강한가?`
- `특수 개입을 쓸 건가 말 건가?`
- `왜 이렇게 작동하는가?`

즉 Basic에선 `Filter`라는 탭보다 `Protection`이 맞다.

`Protection` 안에 포함될 것:
- Protection Degree
- 자동 상태 설명
- 현재 상태 이유
- 허용된 artifact ON/OFF
- 최근 개입 히스토리 요약

## 6) 왜 Basic에서 Artifacts를 별도 탭으로 두지 않는가

Artifacts는 중요하다. 하지만 Basic 사용자에게는 독립 관리 대상이기보다 `보호 방식의 일부`다.

따라서 Basic에선 아래처럼 처리하는 것이 맞다.

- Artifact는 숨기지 않는다
- 다만 `Protection` 안의 한 섹션으로 둔다
- 시각 자산과 설명은 충분히 살린다
- 세부 정책은 감춘다

즉 Basic의 artifact는 `보호 옵션`이고, Pro의 artifact는 `정책 객체`다.

## 7) Pro Mode 최종 탭

권장 최종 구조:

- `Overview`
- `Sites`
- `Presets`
- `Artifacts`
- `Explain`
- `Garden`
- `Settings`

### 7.1 Overview

역할:
- 현재 preset
- 주요 개입 요약
- 효과 리포트 요약
- 주간 추세

### 7.2 Sites

역할:
- 사이트별 목표 시간
- site override
- site preset 적용
- site별 상태 분석

### 7.3 Presets

역할:
- Basic 자동 전략의 상위 번들 설계
- global preset
- custom preset 저장/복제/삭제
- lane curve 및 context 조합 관리

### 7.4 Artifacts

역할:
- artifact 정책 조율
- enabled / autoTrigger
- cooldown preset
- artifact별 최근 발동 및 strictness

artifact taxonomy note:

- Pro `Artifacts`는 다섯 canonical family를 기준으로 정렬한다
- `Lens / Veil / Barrier / Flare / Echo`
- `Lens`와 `Veil`은 filter-backed execution일 수 있지만, 사용자 IA와 대시보드 구조에서는 다른 artifact family와 동등한 1급 artifact로 취급한다
- legacy runtime ids는 execution detail로만 남는다

### 7.5 Explain

역할:
- why / how 분석
- level 상승 이유
- direct trigger 로그
- effectiveness replay
- 어떤 전략이 실제로 먹혔는지 설명

### 7.6 Garden

역할:
- Basic과 동일
- 다만 Pro에선 더 많은 상태 해석과 scanner view 제공 가능

### 7.7 Settings

역할:
- 앱 전역 설정
- 실험실 entrypoint

## 8) 왜 Pro에서도 Filter 탭은 만들지 않는가

Pro 사용자도 결국 원하는 것은 `정책 조율`이지 `필터 키 나열`이 아니다.

그래서 필터 관련 조정은 아래로 흡수하는 것이 맞다.

- `Presets`
- `Advanced` section inside Presets or Settings
- `Lab` for raw tuning

즉 Pro에서도 탑레벨 탭 이름을 `Filter`로 두는 것은 좋은 IA가 아니다.

## 9) Lab의 위치

Lab은 탑레벨 탭으로 기본 노출하지 않는 쪽이 좋다.

권장 위치:
- `Settings > Advanced > Lab`
- 또는 Pro에서만 보이는 secondary entry

이유:
- raw tuning은 power-user 중에서도 일부만 필요하다
- 너무 앞에 나오면 제품의 중심 가치가 다시 흐려진다

## 10) 최종 탭 비교표

| Mode | Tabs |
|---|---|
| `Basic` | `Overview / Sites / Garden / Protection / Settings` |
| `Pro` | `Overview / Sites / Presets / Artifacts / Explain / Garden / Settings` |

## 11) 탭 전환 원칙

### Basic -> Pro

사용자가 다음 단계로 넘어갈 때만 Pro를 권한다.

예:
- 여러 사이트에 서로 다른 전략이 필요함
- artifact 정책을 더 세밀하게 조절하고 싶음
- 왜 특정 개입이 일어나는지 더 깊게 보고 싶음

### Pro -> Basic

Basic은 축소판이 아니라 `권장 운영 모드`여야 한다.

즉 Pro를 쓴다고 해서 Basic이 열등하게 느껴지면 안 된다.

## 12) 구현 원칙

- Basic과 Pro는 내부 protection engine을 공유한다
- 차이는 탑레벨 IA와 설정 노출 범위에 있다
- Basic은 `목표와 신뢰`, Pro는 `정책과 설명`이 중심이다
- Garden은 양쪽 모두에서 유지하되, 기본 홈은 아니다

## 13) 단계별 구현 우선순위

### Phase 1
- Basic에서 `Filter -> Protection` 의미 전환
- Basic 홈을 `Overview`로 고정
- Garden 분리 준비

### Phase 2
- Pro에서 `Presets / Artifacts / Explain` 구조를 정식화
- Filter 개념을 top-level에서 제거

### Phase 3
- Lab을 Settings 하위로 격리
- 모드 전환 copy와 onboarding 정리

## 14) 최종 결론

최종적으로 가장 좋은 구조는 다음과 같다.

- Basic은 `Overview / Sites / Garden / Protection / Settings`
- Pro는 `Overview / Sites / Presets / Artifacts / Explain / Garden / Settings`

그리고 이 구조에서 중요한 것은 단순히 탭 개수가 아니라, 사용자에게 내부 구현 개념을 직접 떠넘기지 않는 것이다.

`Filter`는 내부 구조로 남고, 사용자에게는 `Protection`이라는 더 자연스러운 의미로 전달되는 것이 맞다.
