# Structure Hygiene Audit Checklist

- Status: Active
- Owner: repository governance
- Last validated against code: 2026-04-03
- Path policy: current-only
- Canonical for: recurring repository-wide structure/code hygiene audits covering legacy mix, migration seams, boundary drift, and owner-file hotspots

## Purpose

이 문서는 Entropy 저장소를 주기적으로 점검할 때 어떤 구조 부채를 먼저 보고, 어떤 근거를 남기고, 어떤 기준으로 우선순위를 정할지 정리한 감사 체크리스트다. 목표는 "코드가 지저분해 보인다"는 인상을 증거 기반의 구조 findings로 바꾸는 것이다.

## Scope

- In scope:
  - legacy/canonical 경로 혼재
  - migration code와 active runtime code의 혼재
  - storage owner/path 경계 이탈
  - import boundary drift와 compatibility shell 오남용
  - deprecated barrel/shim이 active code에 남아 있는 상태
  - 구조 위반을 숨기는 hidden fallback / silent recovery
  - 큰 owner 파일과 책임 과밀
  - contract test 누락
  - bundle/runtime hotspot
- Out of scope:
  - 순수 스타일 취향 차이
  - 구조 신호가 없는 단발성 기능 버그
  - 제품 방향성 자체 변경

## Current baseline

- `npm run build` 통과는 필요 조건일 뿐 충분 조건이 아니다.
- compatibility는 input boundary 또는 migration-only shell에만 허용된다.
- 구조 위반을 가리는 fallback은 금지되며, canonical contract mismatch는 fail-fast로 surface되어야 한다.
- legacy alias/key/shape는 내부 owner graph 안으로 전파되면 안 된다.
- migration은 가능하면 explicit upgrade step이어야 하며, normal read path에서 영구적으로 수행되면 안 된다.
- 감사 결과는 최소한 아래 네 가지를 남겨야 한다.
  - 지금 바로 제거 가능한 것
  - explicit migration으로 옮겨야 하는 것
  - 문서화된 bounded compatibility로 남겨도 되는 것
  - owner/file-size 후속 리팩터링 후보

## Source of truth

- Code anchors:
  - `src/`
  - `tests/`
- Related docs:
  - [document-registry.md](/home/ryuji/projects/Entropy/docs/governance/document-registry.md)
  - [fallback-elimination-policy.md](/home/ryuji/projects/Entropy/docs/governance/fallback-elimination-policy.md)
  - [refactoring-playbook.md](/home/ryuji/projects/Entropy/docs/governance/refactoring-playbook.md)
  - [import-boundaries.md](/home/ryuji/projects/Entropy/docs/governance/import-boundaries.md)
  - [01-topology.md](/home/ryuji/projects/Entropy/docs/system-architecture/01-topology.md)
  - [02-runtime-storage-boundaries.md](/home/ryuji/projects/Entropy/docs/system-architecture/02-runtime-storage-boundaries.md)
  - [03-theme-plugin-and-zen.md](/home/ryuji/projects/Entropy/docs/system-architecture/03-theme-plugin-and-zen.md)
  - [pre-release-development-profile-reset.md](/home/ryuji/projects/Entropy/docs/operations/runbooks/pre-release-development-profile-reset.md)

## Rules or contracts

### 1. Canonical owner

- 한 데이터/런타임 계약에는 owner가 하나여야 한다.
- canonical owner 밖에서 raw shape를 직접 읽거나 쓰는 call site는 finding이다.
- alias/legacy ID는 input boundary에서 즉시 canonicalize해야 한다.

### 2. Compatibility, migration, and fallback discipline

- current release contract 밖의 compatibility는 허용하지 않는다.
- previous-key read/write-through를 normal runtime path에 남기지 않는다.
- 공개 후 migration이 필요하면 별도 architecture decision과 named one-shot owner를 먼저 추가한다. 현재 release V1 runtime에는 migration owner가 없다.
- sunset trigger가 없는 compatibility는 구조 부채다.
- hidden fallback은 owner/boundary 문제를 덮기 때문에 finding이다.
- canonical path가 깨졌을 때 silent default를 반환하는 구조는 fail-fast contract 위반이다.

### 3. Storage boundary discipline

- business data는 typed store/repository/query service를 통해서만 간다.
- feature code는 raw `chrome.storage.*`, raw Chrome helpers, direct IndexedDB manager import를 새로 도입하면 안 된다.
- `window.localStorage`는 UI/debug/page-local mirror 용도만 허용한다.

### 4. Import boundary discipline

- retired broad facade나 old root path는 forwarding-only shell만 허용한다.
- active code는 deprecated barrel/shim에 의존하지 않는다.
- deep import가 필요할 때는 public seam 부재인지 먼저 확인하고, 필요하면 seam을 추가한다.

### 5. Owner-file hotspot discipline

- 큰 파일은 line count만으로 판단하지 않고 책임 수를 함께 본다.
- 아래가 동시에 보이면 hotspot으로 분류한다.
  - UI + runtime + storage + worker orchestration 혼재
  - 같은 normalize/patch/merge 로직 중복
  - import graph가 과도하게 넓음
  - 테스트 없이 수정 시 회귀 범위가 넓음

### 6. Contract tests and runtime verification

- boundary/migration/normalization 변경은 contract test가 있어야 한다.
- bundle/runtime 구조 변경은 `npm run build`와 필요한 smoke path를 함께 본다.
- "동작은 된다"가 아니라 "경계 계약이 유지된다"를 검증해야 한다.

## Audit workflow

1. Hotspot inventory를 뽑는다.
   - 큰 파일, 중심 owner 파일, 번들 큰 chunk를 찾는다.
2. Legacy/compat/migration 흔적을 스캔한다.
   - `legacy`, `compat`, `deprecated`, `migrate`, `fallback`, `graceful` 키워드와 legacy key/id 상수를 찾는다.
3. Storage boundary를 스캔한다.
   - raw storage API, `localStorage`, direct IndexedDB manager 접근 여부를 본다.
4. Import boundary를 스캔한다.
   - deprecated barrel, forwarding shell, deep import, retired path 의존을 찾는다.
5. Active contract에 남은 legacy/fallback을 분류한다.
   - input-boundary 허용인지, documented degraded mode인지, runtime owner graph 안에 남아 있는지 구분한다.
6. Test/runtime coverage를 확인한다.
   - boundary contract test, migration test, loud-failure evidence, build/smoke 유무를 본다.
7. Findings를 세 묶음으로 정리한다.
   - remove now
   - explicit migration needed
   - safe-but-bounded cleanup

## Repeatable scan prompts

- `rg -n "LEGACY_|legacy|compat|deprecated|migrat" src tests docs`
- `rg -n "fallback|graceful|mirror|catch \\(_\\)|catch \\(error\\)|catch \\(e\\)" src tests docs`
- `rg -n "localStorage|chrome\\.storage|readChromeStorage|writeChromeStorage|dbManager" src tests`
- `rg --files src tests docs | xargs wc -l | sort -nr | head -n 40`
- `rg -n "export \\* from '../|export \\{ default \\} from '../" src`
- `rg -n "@deprecated|barrel export for backward compatibility" src`

## Review checklist

- [ ] legacy key/id/shape는 input boundary에서만 허용되고 내부 owner graph에는 남지 않는다.
- [ ] migration logic는 explicit entrypoint 또는 one-shot rewrite로 격리되어 있다.
- [ ] canonical path와 legacy path를 동시에 구독하거나 동시에 write하는 active code가 없다.
- [ ] hidden fallback이 owner/runtime core 안에 남아 canonical invariant break를 가리지 않는다.
- [ ] business data가 raw `window.localStorage`에 기록되지 않는다.
- [ ] feature code가 raw Chrome storage helper나 direct IndexedDB manager를 우회 사용하지 않는다.
- [ ] compatibility shell은 forwarding-only이며 active code가 deprecated barrel을 계속 물고 있지 않다.
- [ ] top hotspot 파일은 owner 기준으로 추적되고 있으며, 분해 우선순위가 정리되어 있다.
- [ ] boundary/migration 변경에는 contract test가 있다.
- [ ] runtime/bundle 관련 큰 변경은 build 또는 smoke evidence가 있다.

## Finding classification

- `P1`
  - legacy naming/shape가 active canonical contract 일부로 남아 있음
  - compatibility가 input boundary가 아니라 owner/runtime core 안에 남아 있음
  - hidden fallback이 canonical owner/path mismatch를 runtime에서 가리고 있음
- `P2`
  - implicit read-time migration 또는 dual subscription처럼 bounded debt가 남아 있음
  - deprecated barrel/shim이 active code에서 계속 소비됨
- `P3`
  - immediate regression은 아니지만 큰 owner 파일, forwarding shell, large bundle hotspot이 후속 부채를 키움

## Change guidance

- 새로운 public seam, migration policy, storage rule, import-boundary rule이 생기면 이 문서를 같이 갱신한다.
- scan prompt가 더 이상 현재 저장소 구조를 잘 반영하지 않으면 바로 수정한다.
- audit를 수행할 때는 findings를 이 문서의 분류 기준(`P1`/`P2`/`P3`)으로 남긴다.
