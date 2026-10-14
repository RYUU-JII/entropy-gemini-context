# Retired Basic Mode Automatic Protection PRD

- Status: Hold
- Date: 2026-03-07
- Scope: Historical dashboard basic mode IA + product policy for automatic protection
- Depends on:

- Owner: dashboard product
- Last validated against code: 2026-03-16
- Path policy: planning-allowed

  - `docs/product/dashboard/protection-tab-prd.md`
  - `docs/archive/evidence/protection-cutover-report.md`
  - `docs/archive/legacy-plans/protection-runtime-unified-refactor-master-plan.md`
  - `docs/domains/protection/protection-settings-propagation-policy.md`
  - `docs/product/dashboard/pro-mode-policy-studio-prd.md`
  - `docs/product/dashboard/basic-strategy-orchestrator-prd.md`
  - `docs/product/dashboard/basic-protection-strategy-prd.md`
  - `docs/product/popup/popup-overview-garden-experience-prd.md`
  - `docs/product/garden/garden-ambient-system-prd.md`
  - `docs/product/dashboard/information-architecture-basic-pro-tabs-prd.md`
- Non-goal:
  - protection engine 아키텍처 재리팩터링
  - artifact 세계관/그래픽 리디자인
  - 고급 실험 기능 제거

## 0) Current Product Decision

Entropy no longer ships a Basic Mode inside the app.

- The current app uses one full workspace with all controls available.
- The old simplified-mode direction is reserved for a future standalone `Entropy Lite` app.
- Do not reintroduce an in-app mode selector to hide or reveal advanced controls.

## 1) 제품 한 줄 정의

`사용자는 사이트별 목표 시간과 사용할 artifact만 정하고, 시스템은 그 목표 시간 안으로 사용을 수렴시키기 위해 보호 강도와 개입 타이밍을 자동 조절한다.`

## 2) 왜 필요한가

현재 구조는 엔진 기준으로는 정리됐지만, 제품 기준으로는 아직 사용자가 너무 많은 내부 개념을 직접 상대해야 한다.

- rules
- global friction level
- site policy preset
- fixed / progressive / hard filter
- global cap / site cap
- filter 세부 조정

이 구조는 power-user에겐 의미가 있지만, 기본 사용자에겐 “시스템을 설계해야 하는 UI”로 느껴진다.

Basic Mode의 목적은 이 복잡도를 숨기고, 제품을 아래 모델로 수렴시키는 것이다.

- 사용자는 `목표`를 선언한다.
- 시스템은 `보호`를 자동 조절한다.
- artifact는 `허용된 것만` 조건에 맞게 작동한다.

## 3) 제품 원칙

### 3.1 단순성

기본 모드는 사용자가 정책 엔진을 설계하게 만들지 않는다.

### 3.2 예측 가능성

사용자는 “지금 왜 더 강해졌는가”를 한 문장으로 이해할 수 있어야 한다.

### 3.3 통제감

시스템은 강도를 자동 조절할 수 있지만, 사용자가 허용하지 않은 artifact를 멋대로 켜면 안 된다.

### 3.4 자동화

핵심 판단은 시스템이 맡고, 사용자는 목표와 허용 범위만 정한다.

### 3.5 고급 기능 분리

고급 정책/실험/튜닝은 제거하지 않는다. Basic Mode 밖으로 내린다.

## 4) 사용자 모델

Basic Mode에서 사용자가 직접 설정하는 것은 세 가지뿐이다.

1. 사이트별 목표 시간
2. 보호 성향
3. 사용할 artifact

### 4.1 사이트별 목표 시간

예:

- YouTube: 30분
- Instagram: 20분
- X: 15분

이 값은 protection engine의 주요 기준 입력이 된다.

### 4.2 보호 성향

세 단계만 제공한다.

- `gentle`
- `balanced`
- `strict`

의미:

- 같은 목표 시간이라도 얼마나 빨리 보호가 강해질지 결정한다.

### 4.3 Artifact 허용

artifact는 Basic Mode에서도 보이되, 설정 방식은 단순해야 한다.

- Lens: ON/OFF
- Veil: ON/OFF
- Barrier: ON/OFF
- Flare: ON/OFF
- Echo: ON/OFF

설명 원칙:

- Basic은 canonical artifact family를 기준으로 보여준다
- `Lens`와 `Veil`은 filter-backed execution일 수 있지만 Basic IA에서는 별도 분류로 분리하지 않는다
- `loopBreaker`, `timeAnchor`, `sentinelFlare`, `memoryPurge` 같은 이름은 execution detail 또는 advanced/runtime 설명에서만 드러난다

고급 옵션(`autoTrigger`)은 Advanced로 내린다.

## 5) 핵심 정책 모델

### 5.1 시스템 모델

시스템은 내부적으로 아래 값을 계산한다.

- `budgetRatio = todayUsage / dailyGoal`
- `protectionLevel`
- `artifactState`

### 5.2 보호 상승 원칙

기본 원칙:

- ambiguous signal -> level 상승
- direct trigger -> enabled artifact 발동

예:

- 과탐색, 빠른 전환, 장기 세션 -> level만 상승
- 무한스크롤 감지 -> Loop Breaker 발동 가능
- 숏폼 진입 / 비디오 seek abuse -> Time Anchor 발동 가능
- 목표 초과 임박 / 초과 -> Sentinel Flare 발동 가능

### 5.3 Level reinforcement 원칙

- 사용자가 켠 필터의 level만 높인다.
- artifact는 `ON`된 것만 사용한다.
- 추가 필터나 artifact를 시스템이 임의 활성화하지 않는다.

### 5.4 기본 상승 구간

`balanced` 기준 기본값:

- `0.00 ~ 0.60`: 기본 보호
- `0.60 ~ 0.85`: 점진 강화
- `0.85 ~ 1.00`: 강한 보호
- `> 1.00`: 하드 락

`gentle`, `strict`는 이 구간의 시작 시점만 조정한다.

## 6) 정보 구조

Basic Mode는 기존 복잡한 탭 구조를 직접 제거하지 않고, 사용자에게 보이는 의미를 재정의한다.

### 6.1 Overview

보여줄 것:

- 오늘 전체 사용량
- 사이트별 진행률
- 현재 보호 상태
- 현재 활성 artifact
- 하드 락 여부
- Garden snapshot

원칙:

- Basic의 기본 홈은 `Overview`다
- 메인 씬은 기본 홈이 아니라 `Garden` 탭으로 분리한다
- 세계관 자산은 사라지지 않고 `Overview snapshot + Garden 탭` 구조로 재배치한다

핵심 문구:

`오늘 목표 시간 안으로 들어오도록 보호가 자동 조절되고 있습니다.`

### 6.2 Sites

기존 `Rules` 탭의 Basic Mode 핵심 화면이다.

보여줄 것:

- 관리 사이트 목록
- 각 사이트의 하루 목표 시간
- 현재 진행률
- 오늘 사용 시간

숨길 것:

- site policy preset
- fixed / progressive / commitment 같은 정책 용어
- global friction level

핵심 액션:

- 사이트 추가
- 목표 시간 변경
- 관리 제외
- Popup에서 등록된 사이트의 빠른 후속 조정

보조 원칙:

- 기본 등록 entrypoint는 대시보드보다 Popup이 우선이다
- Sites는 Popup에서 만든 결정을 장기 관리하는 장소다

### 6.3 Protection

기존 `Filter` 탭의 Basic Mode 핵심 화면이다.

보여줄 것:

- 자동 보호 ON/OFF
- 보호 성향 선택(`gentle / balanced / strict`)
- 현재 보호 상태 요약
- 왜 지금 이 강도인지 설명

숨길 것:

- 세부 필터 슬라이더
- 개별 filter key 편집
- 실험 시각 효과

### 6.4 Artifacts

기존 `Tools` 탭의 Basic Mode 핵심 화면이다.

보여줄 것:

- artifact 카드
- ON/OFF
- 현재 상태(armed / engaged / idle)
- 어떤 상황에서 작동하는지 설명
- canonical family 기준 정렬
  - `Lens / Veil / Barrier / Flare / Echo`

숨길 것:

- 디버그 버튼
- 테스트 액션
- 물리값 튜닝
- 내부 runtime 세부 수치

### 6.5 Advanced

기존 power-user 설정과 실험 기능은 여기로 이동한다.

포함:

- site strategy
- global friction level
- 세부 filter tuning
- hard filter 세부값
- artifact advanced flags
- debug / lab controls

## 7) 화면별 UX 문구

### 7.1 Sites

- `하루 목표 시간`
- `오늘 사용량`
- `진행률`
- `이 사이트는 하루에 얼마나 쓸지 정하세요.`

### 7.2 Protection

- `자동 보호`
- `보호 성향`
- `현재 보호 상태`
- `보호 강도는 사용량과 소비 패턴에 따라 자동으로 조절됩니다.`

### 7.3 Artifacts

- `사용할 Artifact`
- `이 Artifact는 특정 패턴에서만 작동합니다.`
- `켜지 않은 Artifact는 자동으로 사용되지 않습니다.`
- `Lens / Veil / Barrier / Flare / Echo` 기준으로 이해할 수 있어야 한다.

### 7.4 Reinforcement 상태

- `목표 시간을 초과해 보호가 최대 강도로 전환되었습니다.`
- `허용된 Artifact만 함께 작동합니다.`

## 8) 현재 코드 기준 매핑

현재 구조에서 Basic Mode는 아래처럼 매핑한다.

- [SitesTab.jsx](/home/ryuji/projects/Entropy/src/apps/dashboard/tabs/sites/SitesTab.jsx)
  - Basic Mode에서는 `Sites` 의미로 축소
- [useSitesController.js](/home/ryuji/projects/Entropy/src/apps/dashboard/tabs/sites/useSitesController.js)
  - siteGoals 중심으로 단순화
  - `globalFrictionLevel`은 단일 관리 정책의 강도 입력으로 잔류
- [registry.js](/home/ryuji/projects/Entropy/src/apps/dashboard/tabs/registry.js)
  - 탭 구조와 i18n-backed route copy를 소유하며, 표기보다 정보 구조를 먼저 고정
- [ProtectionEngine.js](/home/ryuji/projects/Entropy/src/domains/protection/background/runtime/ProtectionEngine.js)
  - 내부 자동화 엔진으로 유지
- [ProfileResolver.js](/home/ryuji/projects/Entropy/src/domains/protection/background/ProfileResolver.js)
  - Basic Mode 입력을 canonical profile로 해석

## 9) 출시 단계

### Phase 1. Basic Mode 정보 구조 도입

- 기본 사용자 노출 항목 축소
- 기존 고급 옵션은 숨기되 제거하지 않음
- Protection / Artifacts / Sites 설명 문구 정리

### Phase 2. Basic Mode 정책 연결

- `siteGoals + posture + artifact enabled`를 중심으로 UI 연결
- 고급 정책이 Basic Mode에 새어 나오지 않도록 차단

### Phase 3. 효과 피드백 도입

- 목표 대비 절감 시간
- 개입 횟수
- artifact 활성 이력

## 10) 성공 지표

- Basic Mode 사용자 설정 완료 시간 감소
- 첫 설정 후 이탈률 감소
- Sites 탭 내 미사용/이해 실패 행동 감소
- artifact 활성화율 증가
- 하드 락 후 재진입률 감소
- 목표 시간 대비 사용량 감소

## 11) 비목표

이번 PRD는 아래를 포함하지 않는다.

- 새로운 artifact 추가
- behavior signal 정의 변경
- protection engine level 알고리즘 재설계
- theme별 아트 리뉴얼

## 12) 권장 구현 순서

1. Basic Mode 전용 정보 구조 확정
2. `Rules -> Sites`, `Filter -> Protection`, `Tools -> Artifacts` 의미 재정의
3. Advanced 분리
4. Basic Mode 설명/상태 문구 정리
5. 마지막에 usage feedback 추가

## 13) 결론

Basic Mode의 핵심은 설정을 많이 주는 것이 아니라,
사용자에게 필요한 결정만 남기는 것이다.

즉:

- 사용자는 목표 시간을 정하고
- 시스템은 자동으로 보호를 조절하고
- artifact는 허용된 것만 동작한다

이 구조가 지금 protection 아키텍처와 가장 잘 맞고,
제품을 가장 명확하고 단순하게 만든다.

## 14) 다음 제품 단계 연결

Basic Mode의 최종 완성은 단순한 threshold 강화가 아니라 `Strategy Orchestrator` 위에서 이뤄진다.

연결 문서:
- `docs/product/dashboard/basic-strategy-orchestrator-prd.md`

의미:
- 이 문서는 Basic의 IA와 사용자 모델을 정의한다.
- `Basic Strategy Orchestrator PRD`는 그 IA 뒤에서 실제로 어떤 전략이 자동 선택되고 조정되는지 정의한다.
