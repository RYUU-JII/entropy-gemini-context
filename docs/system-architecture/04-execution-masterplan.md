# 04. Execution Masterplan

- Status: Active
- Owner: repository architecture
- Last validated against code: 2026-03-17
- Path policy: current-only
- Canonical for: architecture execution sequencing and cutover order

## Purpose

최종 구조에 도달하기 위한 실행 순서와 하드 완료 조건을 고정한다.
이 문서는 “무엇을 조금씩 개선할까”가 아니라 “어떤 세션이 끝났을 때 어떤 old 구조가 canonical 지위를 잃어야 하는가”를 정의한다.

## Important Interpretation

이 문서는 독립 구현 문서가 아니다.

- `01`, `02`, `03`, `05`가 실제 구현 대상이다.
- `04`는 그 문서들을 어떤 순서와 기준으로 판정할지 정하는 orchestration 문서다.
- 에이전트에게 `04를 구현하라`고 주는 것이 아니라, `01~03`과 `05` 작업이 끝났는지 판정할 때 쓴다.

## Global Mandate

모든 세션은 아래 규칙을 따른다.

- 새 경로를 추가했으면 old 경로는 canonical 지위를 잃어야 한다.
- wrapper만 추가하고 실제 owner를 그대로 두는 작업은 실패다.
- compatibility layer는 임시 migration 도구일 뿐, 최종 구조의 일부가 아니다.
- build 통과는 필요 조건일 뿐, 충분 조건이 아니다.
- 문서에 적힌 `완전히 사라져야 하는 것`이 남아 있으면 완료가 아니다.
- owner-specific seam 또는 typed setter/query seam이 생긴 세션에서는 old feature-level mutation path를 같은 세션에서 끊어야 한다.
- `일단 generic patch도 남겨두자`는 방식은 hot path cutover의 완료 형태가 아니다.
- final owner가 정해진 뒤에도 old path를 병행 유지하면 회귀 표면만 넓어지므로 실패로 본다.

## No-Compromise Rule For Settings Cutovers

settings/storage 관련 cutover에서는 아래 해석을 강하게 적용한다.

- generic patch primitive는 infra에 남아도 되지만, feature public surface에 남으면 안 된다.
- feature tab/hook/controller가 직접 쓰던 old mutation path는 새 typed seam 도입 세션에서 함께 삭제한다.
- “나중에 제거할 예정인 old path”는 final structure 정의에 포함되지 않는다.
- 최종 상태 판정은 “새 seam이 생겼는가”가 아니라 “old seam이 canonical 지위를 잃고 삭제되었는가”로 한다.

## Session Count

이 마스터플랜은 `6개 세션`으로 나눈다.

별도로 `05-final-background-runtime-owners.md` 기준의 cross-cut track이 있다.
이 트랙은 Session 3과 Session 4 사이에 걸쳐 남은 background runtime owner를 정리한다.

## Session 1. Root Skeleton And Cut Line Declaration

### Goal

- `apps/domains/platform/themes/core/themes/plugins/ui-kit/lib` 골격을 만든다.
- old root가 언제 canonical 지위를 잃는지 먼저 선언한다.

### Hard Completion

- 새 root가 실제 코드베이스에 존재한다.
- owner map이 root 기준으로 정의된다.
- `entries/features/shared`는 canonical future home이 아니라 migration 대상임이 명확하다.

### Must Completely Disappear By The End

- “새 root는 생겼지만 아무도 안 쓴다”는 상태를 정당화하는 해석

### Still Failure If

- 새 root가 있어도 실제 owner map이 문서나 코드에서 여전히 old root 중심으로 설명되는 경우

## Session 2. Apps Migration

### Goal

- runtime entrypoint와 page composition을 `apps/*` 아래로 수렴시킨다.

### Hard Completion

- background/content/dashboard/popup entrypoint가 `apps/*` 아래로 이동한다.
- app layer는 boot, listener registration, runtime wiring, page composition만 남는다.

### Must Completely Disappear By The End

- `entries/*`를 canonical app home으로 보는 구조
- app layer 안의 business rule 구현

### Still Failure If

- app 경로만 바뀌고 domain logic가 그대로 app 안에 남아 있는 경우

## Session 3. Domains Extraction

### Goal

- `tracking/protection/nudge/stats/settings/behavior`를 owner domain 기준으로 수렴시킨다.

### Hard Completion

- 각 domain에 public entrypoint가 생긴다.
- 핵심 규칙은 domain 아래로 이동한다.
- cross-domain internal import가 줄어든다.

### Must Completely Disappear By The End

- “background라서 여기 있다” 식의 배치 기준
- app이 domain 내부 규칙을 직접 구현하는 상태

### Still Failure If

- domain 폴더가 생겼지만 실제 canonical rule은 여전히 old feature/background 폴더에 남아 있는 경우

## Session 4. Platform And Storage Consolidation

### Goal

- runtime, messaging, storage의 low-level home을 `platform`으로 단일화한다.

### Hard Completion

- public storage entrypoint가 `platform/storage/**` 아래로 모인다.
- raw backend는 `platform/internal` 아래로 밀린다.
- app/domain/theme는 public repository/service/capability만 본다.

### Must Completely Disappear By The End

- canonical `shared/storage`
- app/domain/theme의 direct `dbManager` import
- app/domain/theme의 raw chrome storage helper import

### Still Failure If

- `platform/storage`는 생겼지만 실제 canonical read/write path는 여전히 old shared 경로인 경우

## Cross-Cut Track. Background Runtime Owner Redesign

### Goal

- background runtime에 남아 있는 intermediate hub를 final owner 기준으로 정리한다.

### Governing Spec

- `docs/system-architecture/05-background-runtime-owners.md`

### Hard Completion

- retired `TrackingAnalyticsCoordinator.js` path는 다시 만들지 않는다.
- retired `BackgroundStorageSupportService.js` path는 다시 만들지 않는다.
- stats tick/rollover/backup state는 `domains/stats/background/runtime/**`가 canonical owner다.
- snapshot/inspector/reset/import는 separate owner surface를 가진다.

### Still Failure If

- helper를 더 쪼갰지만 old hub를 지우면 owner 설명이 무너지는 경우
- app runtime이 domain/platform owner 대신 business state를 canonical로 소유하는 경우

## Session 5. Theme Core And Plugin Conversion

### Goal

- theme core를 contract/registry/runtime로 정리하고, 각 theme를 plugin manifest 구조로 수렴시킨다.

### Hard Completion

- theme capability lookup이 plugin manifest 기반이 된다.
- theme core는 plugin 내부 경로를 직접 모른다.
- theme implementation의 canonical owner가 `themes/plugins/<themeId>`가 된다.

### Must Completely Disappear By The End

- giant widget import map의 canonical 지위
- cross-theme fallback direct import
- `themes/components/widgets/<themeId>` canonical 지위

### Still Failure If

- manifest가 생겼지만 실제 theme owner는 old widget 트리인 경우

## Session 6. Zen Plugin Unification And Large-File Collapse

### Goal

- Zen one-home 구조를 완성하고, mega file 구조를 해체한다.

### Hard Completion

- Zen canonical home은 `themes/plugins/zen` 하나다.
- Zen durable state는 `platform/storage/themes/zen`로 수렴한다.
- Zen 대형 파일은 widget/runtime/presentation/model/worker-client로 분리된다.

### Must Completely Disappear By The End

- `themes/zen`과 `themes/components/widgets/zen` dual-home
- `main/logic` giant bucket
- widget가 persistence repository를 직접 import하는 구조
- model, serializer, worker bridge, orchestration, UI가 한 파일에 섞인 mega file

### Still Failure If

- 파일 몇 개를 쪼갰지만 canonical owner는 여전히 불명확한 경우

## Final Definition Of Done

아래가 모두 참일 때만 구조 작업이 완료다.

- root topology는 `apps/domains/platform/themes/core/themes/plugins/ui-kit/lib` 중심으로 읽힌다.
- old root는 canonical 지위를 잃었다.
- storage, messaging, theme capability는 `one owner, one public path`를 가진다.
- Zen은 plugin 구조 안에서 설명된다.
- “조금 더 좋아졌다”가 아니라 “최종 구조가 무엇인지”를 코드 경로로 설명할 수 있다.

## Session Prompt Template

```md
목적
- `docs/system-architecture/**` 기준으로 이번 세션의 canonical owner를 실제 코드에 반영한다.

이번 세션 범위
- Session 1~6 중 하나만 수행한다.
- 해당 세션의 `Hard Completion`과 `Must Completely Disappear By The End`를 하드 목표로 삼는다.

비목표
- old path와 new path를 둘 다 canonical로 유지하는 타협
- wrapper만 추가하고 실제 owner는 그대로 두는 작업
- unrelated 기능 추가

강한 제약
- canonical path는 반드시 새 구조 쪽이어야 한다
- compatibility layer는 임시 migration shell만 허용한다
- build 통과 필수
- 문서에 적힌 `Still Failure If` 상태를 남기면 실패다

완료 조건
- 선택한 세션의 `Hard Completion`이 코드 구조로 충족된다
- 선택한 세션의 `Must Completely Disappear By The End`가 canonical path 기준으로 제거된다
- 남은 부채가 있으면 구조상 정확히 어디가 미완료인지 적는다

참고 문서
- `docs/system-architecture/README.md`
- 관련 masterplan 문서
- 필요 시 `docs/system-architecture/05-background-runtime-owners.md`
- 필요 시 `docs/architecture/storage/storage-architecture-target.md`
```
