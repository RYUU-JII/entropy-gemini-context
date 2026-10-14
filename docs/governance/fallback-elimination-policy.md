# Fallback Elimination Policy

- Status: Active
- Owner: repository governance
- Last validated against code: 2026-09-01
- Path policy: current-only
- Canonical for: fail-fast structural policy, fallback prohibition, and fallback-exception discipline

## Purpose

이 문서는 "일단 안 죽게 만들기"를 위해 구조 위반을 숨기는 fallback을 금지한다.
Entropy에서는 broken canonical path를 다른 path로 덮는 것보다, 원인을 진단 가능한 형태로 드러내는 것이 더 안전하다.

핵심 기준은 아래다.

1. canonical owner/path/shape는 하나여야 한다.
2. 그 계약이 깨지면 loud failure가 나와야 한다.
3. fallback은 구조 문제를 치료하지 못하면 debt가 아니라 regression이다.

## Scope

- In scope:
  - runtime/storage/theme/domain/app architecture fallback
  - legacy read-through/write-through compatibility
  - mirror/secondary source of truth fallback
  - cross-theme substitution fallback
  - silent recovery that hides owner or boundary violations
- Out of scope:
  - purely local math/render formatting defaults
  - skeleton/placeholder 같은 presentational loading shell
  - i18n language fallback처럼 별도 canonical doc가 이미 governing 하는 영역

## Non-Negotiable Rules

### 1. Single canonical path

- active runtime path는 canonical owner만 읽고 쓴다.
- canonical path가 없으면 다른 theme, 다른 store, 다른 legacy key로 넘어가지 않는다.
- mirror/cache/debug storage는 canonical source of truth가 될 수 없다.

### 2. Fail fast, fail loud

- owner invariant가 깨지면 explicit error, rejected result, boundary failure UI, telemetry 중 하나로 즉시 surface해야 한다.
- "아무 일도 없었던 것처럼 default를 반환"하는 silent recovery는 금지한다.
- catch는 문제를 진단 가능하게 바꾸는 용도로만 쓰고, 구조 위반을 덮는 용도로 쓰지 않는다.

### 3. No structural fallback in normal runtime

다음은 normal runtime path에서 금지한다.

- canonical key가 비었다는 이유로 legacy key를 계속 읽는 구조
- canonical widget/boot loader가 없다는 이유로 다른 theme 구현을 대신 쓰는 구조
- canonical storage read 실패 시 undeclared alternate backend로 내려가는 구조
- worker failure/circuit-open을 이유로 동일한 semantic work를 main thread/local path에서 재실행하는 구조
- `try/catch` 후 `null`, `false`, `{}`, `[]`, default literal을 반환해 invariant break를 숨기는 구조
- write를 canonical path와 fallback path에 동시에 흘려 second source of truth를 만드는 구조

### 4. Deletion-first cleanup

- 구조 전환은 새 fallback을 추가하는 것이 아니라 old path를 canonical 지위에서 제거하는 방향이어야 한다.
- 공개 후 새 persistence 계약이 필요하면 먼저 architecture decision을 만들고 explicit migration step을 별도 소유한다. 기본 release baseline은 V1이며, 현재 명시된 유일한 version exception은 FeedTempo adaptive-profile checkpoint V2의 lower-schema discard seam이다.
- "일단 이번 버전에서는 fallback 유지"는 exit criteria가 없으면 금지다.

## Allowed Exceptions

새 fallback은 기본적으로 금지다.
아래 예외만 좁게 허용하며, 예외를 추가할 때는 이 문서와 관련 Active doc를 같은 변경에서 갱신해야 한다.

### 1. Input-boundary canonicalization

- 외부 입력에서 legacy alias/key/shape를 받는 것은 허용된다.
- 단, boundary에서 즉시 canonicalize해야 하며 내부 owner graph로 전파하면 안 된다.

### 2. Explicit migration or reset entrypoint

- 공개 후에는 승인된 architecture decision이 있는 경우에만 one-shot rewrite나 versioned upgrader 같은 별도 cutover entrypoint를 허용한다.
- normal read path에 영구적으로 섞이면 안 된다.
- exit criteria와 제거 시점이 문서에 있어야 한다.
- pre-release checkpoint exception은 `FeedTempoProfileCheckpointRepository`가 소유하는 V1→V2 discard seam이다. V1에는 V2의 continuous-screenful evidence가 없으므로 값을 합성하거나 변환하지 않고 exact checkpoint key를 삭제해 재학습한다. 읽을 수 있는 lower schema만 `schema_behind`로 분류하며 malformed/current-invalid/higher schema는 계속 fail-loud한다.
- 이 exception의 진단 신호는 `FEED_TEMPO_CHECKPOINT_DISCARD_REASONS.SCHEMA_BEHIND`와 repository restore receipt다. 계약 테스트는 lower schema 삭제, malformed row 거부, higher schema 거부를 고정한다. 공개 프로필 호환성이 요구되기 전 개발-profile reset baseline에서 V1 row 부재가 보장되면 이 discard seam과 release-version exception을 함께 제거하는 것이 exit condition이다.

- settings에는 pre-hydration 변환·삭제 예외가 없다. 현재 계약과 다른 개발 설정은 `docs/operations/runbooks/pre-release-development-profile-reset.md`의 명시적 whole-profile reset으로 정리한다. 정상 read/write와 cache hydration은 malformed/retired/incomplete 값을 거부하며 실패를 자동 초기화나 부분 rewrite의 권한으로 해석하지 않는다.

### 3. Documented platform degradation seam

- 브라우저 capability 미지원 같은 platform-level 제약은 owner-local degraded mode로 남을 수 있다.
- 단, 아래를 모두 만족해야 한다.
  - 관련 Active architecture doc가 그 seam을 명시한다.
  - 대체 경로가 second source of truth를 만들지 않는다.
  - telemetry/error code/manual smoke가 있다.
  - semantic substitution이 아니라 bounded degraded mode다.

### 4. Pure presentation defaults

- copy placeholder, empty-state frame, formatting default처럼 business decision을 바꾸지 않는 UI-only default는 허용된다.
- 저장/정책/owner selection/runtime control flow를 결정하면 이 예외에 포함되지 않는다.

## Required Controls For Any Exception

예외가 허용되려면 아래를 모두 충족해야 한다.

1. owner와 boundary가 이름으로 문서화되어 있다.
2. fallback이 아니라 degraded mode인지, migration인지, input canonicalization인지 분류가 명확하다.
3. error code, telemetry, 또는 failure UI로 진단 가능성이 확보된다.
4. contract test, migration test, 또는 smoke evidence가 있다.
5. sunset trigger 또는 장기 유지 근거가 있다.
6. 관련 Active doc와 CI/guardrail이 같은 변경에서 갱신된다.

## Review Questions

- canonical source를 제거했을 때 즉시 실패가 surface되는가?
- legacy/mirror/fallback path가 없어도 원인을 진단할 수 있는가?
- 현재 fallback이 second source of truth를 만들고 있지 않은가?
- fallback이 실제로는 owner/boundary 문제를 숨기고 있지 않은가?
- 이 예외가 Active doc 없이 코드 안에만 숨어 있지 않은가?

## Audit Workflow

1. canonical owner/path/shape를 먼저 적는다.
2. 그 다음 legacy read, mirror read, cross-theme substitution, silent catch를 찾는다.
3. fallback이 가리는 invariant를 문장으로 적는다.
4. fallback을 제거했을 때 어떤 loud failure가 나와야 하는지 정의한다.
5. explicit migration 또는 bounded degraded mode가 필요한지 판정한다.
6. 제거 가능하면 바로 삭제한다.
7. 불가피한 예외면 Active doc, test, telemetry, exit criteria를 같은 change set에 넣는다.

## Repeatable Scan Prompts

- `rg -n "fallback|graceful|legacy|mirror|catch \\(_\\)|catch \\(error\\)|catch \\(e\\)" src tests`
- `rg -n "localStorage|sessionStorage|chrome\\.storage|readChromeStorage|writeChromeStorage|dbManager" src tests`
- `rg -n "\\|\\| .*DEFAULT_|\\?\\? .*DEFAULT_" src tests`
- `rg -n "return null;|return false;|return \\{\\};|return \\[\\];" src/platform src/apps src/domains src/themes`

## Recommended Audit Order

1. theme loader / theme substitution seams
2. storage mirror / localStorage / legacy key compatibility seams
3. worker degraded-mode and circuit/fallback seams
4. boot/bootstrap/settings second-source reads
5. dashboard/popup/content runtime boundary shells

## Related Docs

- [AGENTS.md](/home/ryuji/projects/Entropy/AGENTS.md)
- [agent-start-here.md](/home/ryuji/projects/Entropy/docs/governance/agent-start-here.md)
- [structure-hygiene-audit-checklist.md](/home/ryuji/projects/Entropy/docs/governance/structure-hygiene-audit-checklist.md)
- [refactoring-playbook.md](/home/ryuji/projects/Entropy/docs/governance/refactoring-playbook.md)
- [02-runtime-storage-boundaries.md](/home/ryuji/projects/Entropy/docs/system-architecture/02-runtime-storage-boundaries.md)
- [03-theme-plugin-and-zen.md](/home/ryuji/projects/Entropy/docs/system-architecture/03-theme-plugin-and-zen.md)
