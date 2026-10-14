# 01. Topology

- Status: Active
- Owner: repository architecture
- Last validated against code: 2026-07-13
- Path policy: current-only
- Canonical for: repository topology and root ownership rules

## Purpose

현재 채택된 `src` 구조를 정의한다.
이 문서는 파일과 폴더의 canonical owner를 정의한다.

## Invariants And Current Implementation Policy

계약 분류는 [Document System](../governance/document-system.md#계약의-성격과-변경-절차)을 따른다.

- **불변 조건:** canonical state와 책임에는 식별 가능한 단일 owner가 있다.
  app composition, domain 규칙, 저수준 adapter, theme 표현의 책임을 분리하고,
  소비자는 공개 경계를 통해 접근한다. 경로 이동으로 두 번째 owner나 우회 경로를 만들지 않는다.
- **현재 구현 정책:** 아래 root 이름과 디렉터리 배치, 구체적인 dependency edge,
  retired path 목록은 위 경계를 현재 구현하는 방식이다. 현재의 owner 판정과
  import 검사는 이 정책을 계속 강제한다.

owner 경로나 공개 seam을 바꾸는 경우 책임의 이전 위치와 이후 위치, 소비자 경로,
퇴역 경로의 처리와 경계 검증을 같은 변경에서 맞춘다. `Final`과 cutover 완료
기준은 현재 채택된 전환의 완료 판정이며, 경계가 보존되는 후속 정책 변경을 막지 않는다.
compatibility shell이나 fallback을 새로 허용하는 근거로 쓰지 않으며,
예외는 기존 `docs/governance/fallback-elimination-policy.md`를 따른다.

## Independent Execution Scope

이 문서는 독립 세션이 직접 수행할 수 있는 execution spec이다.

- 이 문서의 대상은 `root topology`와 `owner cut line`이다.
- 이 문서는 `04`의 하위 문서가 아니라, `04`가 판정 기준으로 사용하는 독립 목표다.
- 이 문서의 세션은 `새 root를 추가하는 것`이 아니라 `old root가 canonical 지위를 잃게 만드는 것`을 끝내야 한다.

## Big-Bang Cutover Mode

이 문서는 점진 개선용이 아니다.
수행 방식은 아래처럼 해석한다.

- 새 canonical root를 먼저 정한다.
- old root에 남아 있던 canonical owner를 같은 세션에서 끊는다.
- 중간에 build나 테스트가 깨지는 것은 허용한다.
- 마지막에만 연결을 복구하고 build/test를 수렴시킨다.

중간 green 상태를 유지하려고 old path를 계속 canonical로 두는 것은 실패다.

## Final Root Shape

```text
src/
  apps/
    background/
    boot/
    content/
    dashboard/
    landing/
    feed-landing/
    popup/
  domains/
    behavior/
    nudge/
    protection/
    settings/
    stats/
    tracking/
  platform/
    chrome/
    messaging/
    rendering/
    security/
    storage/
    workers/
  themes/
    core/
    plugins/
      clinical/
      cyberpunk/
      entropy/
      matrix/
      scp/
      zen/
  ui-kit/
  lib/
```

## Root Ownership

- `apps`
  runtime entrypoint, boot, listener registration, page composition, route wiring만 가진다.
  Background와 dashboard가 함께 사용하는 cross-entry boot business contract는
  broad `shared`가 아니라 `apps/boot`의 named seam에 둔다.
  `apps/landing`은 MV3 runtime과 분리된 public static page composition을 소유하고,
  별도 Vite config와 `dist-landing/` 출력을 사용한다.
  `apps/feed-landing`은 별개의 유한 피드 소개 웹사이트이며, 자체 content/model/data/
  presentation 경계와 `dist-feed-landing/` 출력을 사용한다. 세션 반응은 이 웹사이트의
  메모리 상태이고 확장의 domain/storage/runtime owner를 획득하지 않는다.
- `domains`
  제품 기능의 핵심 규칙, use case, domain-owned public API를 가진다.
- `platform`
  Chrome API, storage backend, worker/rendering runtime, message transport, low-level security/runtime adapter를 가진다.
- `themes/core`
  theme capability contract, registry, runtime orchestration만 가진다.
- `themes/plugins/<themeId>`
  해당 theme의 구현체만 가진다.
- `ui-kit`
  theme-neutral reusable UI만 가진다.
- `lib`
  side-effect free utility만 가진다.

## Final Dependency Direction

- `apps -> domains`
- `apps -> themes/core`
- `apps -> ui-kit`
- `apps -> lib`
- `domains -> platform`
- `domains -> lib`
- `themes/core -> themes/plugins/*/manifest`
- `themes/plugins/* -> themes/core`
- `themes/plugins/* -> ui-kit`
- `themes/plugins/* -> lib`
- `themes/plugins/* -> platform` only through explicit public surfaces

## What Must Completely Disappear

최종 구조에서 아래는 canonical root가 아니다.

- pre-cutover entry root
- pre-cutover feature root
- pre-cutover shared root
- `src/themes/components/widgets/<themeId>`를 canonical theme home으로 보는 구조
- `src/themes/shared/**`를 theme shared seam으로 보는 구조
- pre-cutover Zen dual-home 구조

위 경로들은 최종적으로 아래 상태 중 하나여야 한다.

- 삭제됨
- migration-only compatibility shell

그 외 상태는 실패다.

여기서 `migration-only compatibility shell`의 의미는 엄격하다.

- old path가 새 path를 재-export 또는 one-line bridge만 한다
- business logic, runtime wiring, canonical state transition이 old path에 남아 있지 않다
- 새 코드가 old path를 향해 추가되지 않는다

## What Counts As Failure

아래 중 하나라도 남아 있으면 구조 작업은 미완료다.

- 새 `apps/domains/platform/...`가 생겼지만 실제 canonical 코드는 여전히 `entries/features/shared`에 있는 상태
- owner가 불명확한 새 `shared`성 폴더가 다시 생기는 상태
- “일단 이동만 해두고 import는 예전 경로를 계속 쓰는 상태”
- root 이름만 바뀌고 책임 분리는 그대로인 상태
- old root가 compatibility shell이 아니라 여전히 구현 owner인 상태
- manifest/page/vite entrypoint는 새 root를 가리키지만 실제 source of truth는 old root인 상태

## Tests And Build Policy

- 테스트와 build는 최종 검증 수단이지, old root를 계속 살려두기 위한 제약이 아니다.
- 이 문서의 세션은 중간 단계에서 test/build break를 허용한다.
- old root를 유지해야만 통과하는 테스트가 있으면, 테스트를 같은 세션에서 새 canonical path 기준으로 업데이트한다.
- `테스트가 깨질까 봐 old canonical path를 유지`하는 것은 실패다.

## Hard Completion Criteria

- 새 파일을 만들 때 root 선택이 즉시 가능해야 한다.
- 경로만 봐도 owner를 맞게 추론할 수 있어야 한다.
- `background라서 여기 있다`가 아니라 `tracking domain이라서 여기 있다`처럼 설명되어야 한다.
- old root는 canonical path가 아니어야 한다.

다음이 모두 참이어야 `완성`이다.

- app entrypoint의 source of truth는 `src/apps/**`다.
- domain-owned code의 source of truth는 `src/domains/**`다.
- old entry/feature/shared split는 삭제되었거나 compatibility shell뿐이다.
- compatibility shell을 열어봤을 때 실질 구현이 아니라 새 canonical path forwarding만 남아 있다.
- 코드 리뷰 시 “이 파일이 왜 여기에 있지?”가 아니라 “이 owner니까 여기 있네”가 성립한다.

## Still Not Complete If

- `src/apps/**`가 사실상 pre-cutover entry root를 부르는 launcher일 뿐인 경우
- `src/domains/**`가 thin facade인데 진짜 로직은 old feature root나 old background entry branch에 남아 있는 경우
- old shared root가 여전히 app/domain contract의 실제 owner인 경우
- old root에 있는 구현 파일을 지우면 시스템 설명이 무너지는 경우

## No-Compromise Rule

`새 구조를 추가하는 것`이 목표가 아니다.
`old 구조가 canonical 지위를 잃는 것`이 목표다.
